// A view's position on screen, as a promise: { x, y, width, height } (null when it can't be measured).
// Own module so tests can stand in for the native measurement.
export const measureInWindow = (node) =>
    new Promise((resolve) => {
        if (!node?.measureInWindow) return resolve(null);
        node.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
    });
