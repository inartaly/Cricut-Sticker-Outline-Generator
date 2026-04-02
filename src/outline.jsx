// Robust outline generation:
// 1. Load image into canvas
// 2. Build alpha mask
// 3. Trace outer contour using Moore-neighbor border following
// 4. Optionally simplify contour
// 5. Generate SVG path
// 6. Generate PNG by dilating mask + compositing original image

export async function generateOutlinePNGAndSVG({
    imageSrc,
    canvas,
    outlineThickness
}) {
    const img = await loadImage(imageSrc);

    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");

    // Draw image to canvas to get pixel data.
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const mask = buildAlphaMask(imageData);

    // Trace contour; if none, just return original image as PNG and empty SVG.
    const contour = traceContour(mask, canvas.width, canvas.height);

    let svgString;
    if (!contour || contour.length === 0) {
        svgString = emptySvg(canvas.width, canvas.height);
    } else {
        const simplified = simplifyRDP(contour, 1.5);
        svgString = contourToSvg(
            simplified,
            canvas.width,
            canvas.height,
            outlineThickness
        );

    }

    const pngDataUrl = generatePngOutline({
        ctx,
        img,
        mask,
        width: canvas.width,
        height: canvas.height,
        outlineThickness
    });

    return { pngDataUrl, svgString };
}

// Load image from data URL.
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

// Build binary mask from alpha channel.
function buildAlphaMask(imageData) {
    const { data, width, height } = imageData;
    const mask = new Array(width * height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const alpha = data[idx + 3];
            mask[y * width + x] = alpha > 10; // threshold
        }
    }

    return mask;
}

function emptySvg(width, height) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"></svg>`;
}

// Moore-neighbor border following to trace outer contour.
function traceContour(mask, width, height) {
    // Find a starting border pixel: solid with at least one non-solid neighbor.
    let startX = -1;
    let startY = -1;

    outer: for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            if (!mask[y * width + x]) continue;
            if (isBorder(mask, width, height, x, y)) {
                startX = x;
                startY = y;
                break outer;
            }
        }
    }

    if (startX === -1) return [];

    const contour = [];
    let cx = startX;
    let cy = startY;

    // Directions (dx, dy) in clockwise order.
    const dirs = [
        [1, 0],
        [1, 1],
        [0, 1],
        [-1, 1],
        [-1, 0],
        [-1, -1],
        [0, -1],
        [1, -1]
    ];

    // Start by looking to the left of the direction we came from.
    let dirIndex = 0; // arbitrary initial direction
    let safety = 0;
    const maxSteps = width * height * 8;

    do {
        contour.push([cx, cy]);

        // Search neighbors starting from dirIndex - 2 (turn left).
        let foundNext = false;
        for (let i = 0; i < 8; i++) {
            const idx = (dirIndex + 6 + i) % 8;
            const [dx, dy] = dirs[idx];
            const nx = cx + dx;
            const ny = cy + dy;

            if (
                nx >= 0 &&
                nx < width &&
                ny >= 0 &&
                ny < height &&
                mask[ny * width + nx]
            ) {
                cx = nx;
                cy = ny;
                dirIndex = idx;
                foundNext = true;
                break;
            }
        }

        if (!foundNext) break;

        safety++;
        if (safety > maxSteps) {
            console.warn("Contour tracing safety break.");
            break;
        }
    } while (!(cx === startX && cy === startY && contour.length > 1));

    return contour;
}

function isBorder(mask, width, height, x, y) {
    if (!mask[y * width + x]) return false;
    // If any 4-neighbor is false, this is a border pixel.
    const neighbors = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
    ];
    for (const [dx, dy] of neighbors) {
        const nx = x + dx;
        const ny = y + dy;
        if (
            nx < 0 ||
            nx >= width ||
            ny < 0 ||
            ny >= height ||
            !mask[ny * width + nx]
        ) {
            return true;
        }
    }
    return false;
}

// Ramer–Douglas–Peucker simplification.
function simplifyRDP(points, epsilon) {
    if (!points || points.length < 3) return points || [];

    const { distance: dmax, index } = findFurthestPoint(points);
    if (dmax > epsilon) {
        const left = simplifyRDP(points.slice(0, index + 1), epsilon);
        const right = simplifyRDP(points.slice(index), epsilon);
        return left.slice(0, -1).concat(right);
    } else {
        return [points[0], points[points.length - 1]];
    }
}

function findFurthestPoint(points) {
    const start = points[0];
    const end = points[points.length - 1];
    let maxDist = 0;
    let index = 0;

    for (let i = 1; i < points.length - 1; i++) {
        const d = pointLineDistance(points[i], start, end);
        if (d > maxDist) {
            maxDist = d;
            index = i;
        }
    }

    return { distance: maxDist, index };
}

function pointLineDistance(p, a, b) {
    const [px, py] = p;
    const [ax, ay] = a;
    const [bx, by] = b;
    const dx = bx - ax;
    const dy = by - ay;
    if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
    const t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
    const projX = ax + t * dx;
    const projY = ay + t * dy;
    return Math.hypot(px - projX, py - projY);
}

// Convert contour to SVG path (polyline-style, but smooth enough for Cricut).
function contourToSvg(contour, width, height, outlineThickness) {
    if (!contour || contour.length === 0) return emptySvg(width, height);

    const [startX, startY] = contour[0];
    let d = `M ${startX} ${startY}`;

    for (let i = 1; i < contour.length; i++) {
        const [x, y] = contour[i];
        d += ` L ${x} ${y}`;
    }

    d += " Z";

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg"
     width="${width}"
     height="${height}"
     viewBox="0 0 ${width} ${height}">
  <path d="${d}"
        fill="none"
        stroke="white"
        stroke-width="${outlineThickness}"
        stroke-linejoin="round"
        stroke-linecap="round" />
</svg>
`.trim();

    return svg;
}

// Generate PNG outline by dilating the mask and compositing the original image.
function generatePngOutline({
    ctx,
    img,
    mask,
    width,
    height,
    outlineThickness
}) {
    ctx.clearRect(0, 0, width, height);

    // Offscreen canvas for mask.
    const off = document.createElement("canvas");
    off.width = width;
    off.height = height;
    const offCtx = off.getContext("2d");

    // Paint mask as solid white.
    const maskImageData = offCtx.createImageData(width, height);
    for (let i = 0; i < mask.length; i++) {
        if (mask[i]) {
            const idx = i * 4;
            maskImageData.data[idx] = 255;
            maskImageData.data[idx + 1] = 255;
            maskImageData.data[idx + 2] = 255;
            maskImageData.data[idx + 3] = 255;
        }
    }
    offCtx.putImageData(maskImageData, 0, 0);

    // Draw dilated outline by drawing the mask multiple times with offsets.
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "white";

    const radius = outlineThickness;
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= radius) {
                ctx.drawImage(off, dx, dy);
            }
        }
    }
    ctx.restore();

    // Draw original image on top.
    ctx.drawImage(img, 0, 0);

    return ctx.canvas.toDataURL("image/png");
}
