const defaultStyle = {
    strokeVisible: "black",
    strokeHidden: "black",
    strokeWidth: 1.5,
    dashArrayHidden: "3 3",
    opacityHidden: 1,
    lineCap: "butt",
};
export function piecesToSvg(pieces, camera, opts) {
    const style = { ...defaultStyle, ...(opts.style ?? {}) };
    const { width, height } = opts;
    const paths = [];
    for (const piece of pieces) {
        const d = cubic3ToSvgPathD(piece, camera, width, height);
        const stroke = piece.visible ? style.strokeVisible : style.strokeHidden;
        const extra = piece.visible
            ? ""
            : ` stroke-dasharray="${style.dashArrayHidden}" opacity="${style.opacityHidden}"`;
        const path = `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${style.strokeWidth}" stroke-linecap="${style.lineCap}"` +
            `${extra} />`;
        paths.push(path);
    }
    return (`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
        `<rect width="100%" height="100%" fill="white" />` +
        paths.join("") +
        `</svg>`);
}
function cubic3ToSvgPathD(piece, camera, width, height) {
    const p0 = camera.projectToSvg(piece.bez.p0, width, height);
    const p1 = camera.projectToSvg(piece.bez.p1, width, height);
    const p2 = camera.projectToSvg(piece.bez.p2, width, height);
    const p3 = camera.projectToSvg(piece.bez.p3, width, height);
    return `M ${fmt(p0.x)} ${fmt(p0.y)} C ${fmt(p1.x)} ${fmt(p1.y)} ${fmt(p2.x)} ${fmt(p2.y)} ${fmt(p3.x)} ${fmt(p3.y)}`;
}
function fmt(n) {
    return Number.isFinite(n) ? n.toFixed(3) : "0";
}
