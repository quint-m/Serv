const lerp = (a, b, alpha) => {
    return a + (b - a) * alpha;
};

const lerpState = (aState, bState, alpha) => {
    return {
        ...bState,
        ball: {
            ...bState.ball,
            x: lerp(aState.ball.x, bState.ball.x, alpha),
            y: lerp(aState.ball.y, bState.ball.y, alpha),
        },
        paddles: {
            left: {
                ...bState.paddles.left,
                y: lerp(aState.paddles.left.y, bState.paddles.left.y, alpha),
            },
            right: {
                ...bState.paddles.right,
                y: lerp(aState.paddles.right.y, bState.paddles.right.y, alpha),
            },
        },
    };
}

export { lerp, lerpState };
