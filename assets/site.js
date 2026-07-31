
(() => {
    "use strict";

    /* ---------------------------------------------------------
       Navigation
    --------------------------------------------------------- */

    const navButtons = document.querySelectorAll(".nav-button");
    const sections = document.querySelectorAll("[data-nav-section]");

    navButtons.forEach((button) => {
        button.addEventListener("click", () => {
            navButtons.forEach((item) => item.classList.remove("active"));
            button.classList.add("active");
        });
    });

    if (sections.length) {
        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((entry) => entry.isIntersecting)
                    .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

                if (!visible) return;

                navButtons.forEach((button) => {
                    button.classList.toggle(
                        "active",
                        button.getAttribute("href") ===
                            `#${visible.target.id}`
                    );
                });
            },
            {
                threshold: [0.34, 0.52, 0.70]
            }
        );

        sections.forEach((section) => observer.observe(section));
    }


    const siteHeader = document.querySelector(".site-header");

/*
 * Homepage uses .hero
 * Project pages use .project-hero
 */
const topSection = document.querySelector(
    ".hero, .project-hero"
);

function updateHeaderBackground() {
    if (!siteHeader) return;

    if (topSection) {
        const triggerPoint =
            topSection.offsetTop +
            topSection.offsetHeight -
            siteHeader.offsetHeight;

        siteHeader.classList.toggle(
            "header-glass",
            window.scrollY >= triggerPoint
        );
    } else {
        /*
         * For pages without a hero section,
         * activate glass after a small scroll.
         */
        siteHeader.classList.toggle(
            "header-glass",
            window.scrollY > 30
        );
    }
}

window.addEventListener(
    "scroll",
    updateHeaderBackground,
    { passive: true }
);

window.addEventListener(
    "resize",
    updateHeaderBackground
);

window.addEventListener(
    "load",
    updateHeaderBackground
);

updateHeaderBackground();

    /* ---------------------------------------------------------
       OLD CURSOR EFFECT:
       WebGL fluid/oil distortion — no blob, smoke or ripple.
    --------------------------------------------------------- */

    const supportsFinePointer =
        window.matchMedia("(pointer: fine)").matches;

    const reduceMotion =
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (supportsFinePointer && !reduceMotion) {
        document
            .querySelectorAll(".fluid-distort")
            .forEach(initFluidDistortion);
    }

    function initFluidDistortion(container) {
        const images = Array.from(
            container.querySelectorAll(":scope > img")
        );

        const defaultImage =
            container.querySelector(":scope > .image-default") ||
            images[0] ||
            null;

        const hoverImage =
            container.querySelector(":scope > .image-hover");

        const backgroundSource =
            container.dataset.fluidSrc || "";

        if (!defaultImage && !backgroundSource) {
            return;
        }

        const canvas = document.createElement("canvas");
        canvas.className = "fluid-canvas";
        canvas.setAttribute("aria-hidden", "true");
        container.appendChild(canvas);

        const gl =
            canvas.getContext("webgl", {
                alpha: true,
                antialias: false,
                premultipliedAlpha: false
            }) ||
            canvas.getContext("experimental-webgl");

        if (!gl) {
            canvas.remove();
            return;
        }

        const vertexShaderSource = `
            attribute vec2 a_position;
            varying vec2 v_uv;

            void main() {
                v_uv = a_position * 0.5 + 0.5;
                gl_Position = vec4(a_position, 0.0, 1.0);
            }
        `;

        const fragmentShaderSource = `
            precision highp float;

            uniform sampler2D u_image;
            uniform vec2 u_resolution;
            uniform vec2 u_imageResolution;
            uniform vec2 u_mouse;
            uniform vec2 u_velocity;
            uniform float u_time;
            uniform float u_strength;

            varying vec2 v_uv;

            vec2 coverUv(
                vec2 uv,
                vec2 screenSize,
                vec2 imageSize
            ) {
                float screenRatio =
                    screenSize.x / screenSize.y;

                float imageRatio =
                    imageSize.x / imageSize.y;

                vec2 result = uv;

                if (screenRatio > imageRatio) {
                    float visibleHeight =
                        imageRatio / screenRatio;

                    result.y =
                        (uv.y - 0.5) *
                        visibleHeight +
                        0.5;
                } else {
                    float visibleWidth =
                        screenRatio / imageRatio;

                    result.x =
                        (uv.x - 0.5) *
                        visibleWidth +
                        0.5;
                }

                return result;
            }

            void main() {
                vec2 uv = v_uv;

                vec2 aspect = vec2(
                    u_resolution.x / u_resolution.y,
                    1.0
                );

                vec2 local =
                    (uv - u_mouse) * aspect;

                float distanceToMouse =
                    length(local);

                /* Increase to 0.28 for a larger fluid area. */
                float radius = 0.22;

                float mask =
                    1.0 -
                    smoothstep(
                        radius * 0.24,
                        radius,
                        distanceToMouse
                    );

                mask *= u_strength;

                vec2 direction =
                    local /
                    max(distanceToMouse, 0.0001);

                vec2 tangent = vec2(
                    -direction.y,
                    direction.x
                );

                float lens = clamp(
                    1.0 - distanceToMouse / radius,
                    0.0,
                    1.0
                );

                lens =
                    lens *
                    lens *
                    (3.0 - 2.0 * lens);

                float flowOne = sin(
                    local.x * 18.0 +
                    local.y * 14.0 -
                    u_time * 2.1
                );

                float flowTwo = cos(
                    local.x * 10.0 -
                    local.y * 16.0 +
                    u_time * 1.65
                );

                float swirl = sin(
                    atan(local.y, local.x) * 3.0 +
                    distanceToMouse * 36.0 -
                    u_time * 2.5
                );

                float velocityLength =
                    length(u_velocity);

                vec2 velocityDirection =
                    velocityLength > 0.0001
                    ? normalize(u_velocity)
                    : vec2(0.0);

                float velocityAmount =
                    min(velocityLength, 1.0);

                vec2 distortion =
                    direction *
                    lens *
                    0.0105 *
                    mask;

                distortion +=
                    tangent *
                    flowOne *
                    0.0068 *
                    mask;

                distortion +=
                    direction *
                    flowTwo *
                    0.0045 *
                    mask;

                distortion +=
                    tangent *
                    swirl *
                    0.0038 *
                    mask;

                distortion +=
                    velocityDirection *
                    velocityAmount *
                    0.017 *
                    mask;

                distortion.x /= aspect.x;

                vec2 redUv = coverUv(
                    clamp(
                        uv + distortion * 1.08,
                        0.001,
                        0.999
                    ),
                    u_resolution,
                    u_imageResolution
                );

                vec2 greenUv = coverUv(
                    clamp(
                        uv + distortion,
                        0.001,
                        0.999
                    ),
                    u_resolution,
                    u_imageResolution
                );

                vec2 blueUv = coverUv(
                    clamp(
                        uv + distortion * 0.93,
                        0.001,
                        0.999
                    ),
                    u_resolution,
                    u_imageResolution
                );

                vec3 color = vec3(
                    texture2D(u_image, redUv).r,
                    texture2D(u_image, greenUv).g,
                    texture2D(u_image, blueUv).b
                );

                gl_FragColor = vec4(color, 1.0);
            }
        `;

        function createShader(type, source) {
            const shader = gl.createShader(type);

            gl.shaderSource(shader, source);
            gl.compileShader(shader);

            if (
                !gl.getShaderParameter(
                    shader,
                    gl.COMPILE_STATUS
                )
            ) {
                console.error(
                    "Fluid shader error:",
                    gl.getShaderInfoLog(shader)
                );

                gl.deleteShader(shader);
                return null;
            }

            return shader;
        }

        const vertexShader = createShader(
            gl.VERTEX_SHADER,
            vertexShaderSource
        );

        const fragmentShader = createShader(
            gl.FRAGMENT_SHADER,
            fragmentShaderSource
        );

        if (!vertexShader || !fragmentShader) {
            canvas.remove();
            return;
        }

        const program = gl.createProgram();

        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (
            !gl.getProgramParameter(
                program,
                gl.LINK_STATUS
            )
        ) {
            console.error(
                "Fluid program error:",
                gl.getProgramInfoLog(program)
            );

            canvas.remove();
            return;
        }

        gl.useProgram(program);

        const positionLocation =
            gl.getAttribLocation(
                program,
                "a_position"
            );

        const uniforms = {
            resolution: gl.getUniformLocation(
                program,
                "u_resolution"
            ),
            imageResolution: gl.getUniformLocation(
                program,
                "u_imageResolution"
            ),
            mouse: gl.getUniformLocation(
                program,
                "u_mouse"
            ),
            velocity: gl.getUniformLocation(
                program,
                "u_velocity"
            ),
            time: gl.getUniformLocation(
                program,
                "u_time"
            ),
            strength: gl.getUniformLocation(
                program,
                "u_strength"
            ),
            image: gl.getUniformLocation(
                program,
                "u_image"
            )
        };

        const positionBuffer =
            gl.createBuffer();

        gl.bindBuffer(
            gl.ARRAY_BUFFER,
            positionBuffer
        );

        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([
                -1, -1,
                 1, -1,
                -1,  1,
                -1,  1,
                 1, -1,
                 1,  1
            ]),
            gl.STATIC_DRAW
        );

        gl.enableVertexAttribArray(
            positionLocation
        );

        gl.vertexAttribPointer(
            positionLocation,
            2,
            gl.FLOAT,
            false,
            0,
            0
        );

        const texture =
            gl.createTexture();

        gl.bindTexture(
            gl.TEXTURE_2D,
            texture
        );

        gl.texParameteri(
            gl.TEXTURE_2D,
            gl.TEXTURE_WRAP_S,
            gl.CLAMP_TO_EDGE
        );

        gl.texParameteri(
            gl.TEXTURE_2D,
            gl.TEXTURE_WRAP_T,
            gl.CLAMP_TO_EDGE
        );

        gl.texParameteri(
            gl.TEXTURE_2D,
            gl.TEXTURE_MIN_FILTER,
            gl.LINEAR
        );

        gl.texParameteri(
            gl.TEXTURE_2D,
            gl.TEXTURE_MAG_FILTER,
            gl.LINEAR
        );

        let textureReady = false;
        let imageWidth = 1;
        let imageHeight = 1;
        let canvasWidth = 1;
        let canvasHeight = 1;
        let isVisible = true;

        function uploadTexture(imageElement) {
            if (
                !imageElement ||
                !imageElement.complete ||
                !imageElement.naturalWidth
            ) {
                return;
            }

            imageWidth =
                imageElement.naturalWidth;

            imageHeight =
                imageElement.naturalHeight;

            gl.bindTexture(
                gl.TEXTURE_2D,
                texture
            );

            gl.pixelStorei(
                gl.UNPACK_FLIP_Y_WEBGL,
                true
            );

            try {
                gl.texImage2D(
                    gl.TEXTURE_2D,
                    0,
                    gl.RGBA,
                    gl.RGBA,
                    gl.UNSIGNED_BYTE,
                    imageElement
                );

                textureReady = true;
                container.classList.add("fluid-ready");
            } catch (error) {
                console.error(
                    "Fluid texture error:",
                    error
                );
            }
        }

        function loadTextureFromUrl(url) {
            const imageLoader =
                new Image();

            imageLoader.onload = () => {
                uploadTexture(imageLoader);
            };

            imageLoader.src = url;
        }

        function useImage(imageElement) {
            if (!imageElement) {
                return;
            }

            if (
                imageElement.complete &&
                imageElement.naturalWidth
            ) {
                uploadTexture(imageElement);
            } else {
                imageElement.addEventListener(
                    "load",
                    () => uploadTexture(imageElement),
                    { once: true }
                );
            }
        }

        if (backgroundSource) {
            loadTextureFromUrl(backgroundSource);
        } else {
            useImage(defaultImage);
        }

        if (hoverImage) {
            container.addEventListener(
                "pointerenter",
                () => useImage(hoverImage)
            );

            container.addEventListener(
                "pointerleave",
                () => useImage(defaultImage)
            );
        }

        function resizeCanvas() {
            const bounds =
                container.getBoundingClientRect();

            canvasWidth =
                Math.max(1, bounds.width);

            canvasHeight =
                Math.max(1, bounds.height);

            const pixelRatio =
                Math.min(
                    window.devicePixelRatio || 1,
                    2
                );

            canvas.width =
                Math.round(
                    canvasWidth * pixelRatio
                );

            canvas.height =
                Math.round(
                    canvasHeight * pixelRatio
                );

            gl.viewport(
                0,
                0,
                canvas.width,
                canvas.height
            );
        }

        const resizeObserver =
            new ResizeObserver(resizeCanvas);

        resizeObserver.observe(container);
        resizeCanvas();

        const visibilityObserver =
            new IntersectionObserver(
                (entries) => {
                    isVisible =
                        entries[0]?.isIntersecting ??
                        true;
                },
                {
                    rootMargin: "160px"
                }
            );

        visibilityObserver.observe(container);

        let targetMouseX = 0.5;
        let targetMouseY = 0.5;
        let currentMouseX = 0.5;
        let currentMouseY = 0.5;

        let targetVelocityX = 0;
        let targetVelocityY = 0;
        let currentVelocityX = 0;
        let currentVelocityY = 0;

        let targetStrength = 0;
        let currentStrength = 0;

        let previousPointerX = 0;
        let previousPointerY = 0;
        let pointerInitialized = false;

        container.addEventListener(
            "pointermove",
            (event) => {
                const bounds =
                    container.getBoundingClientRect();

                const localX =
                    event.clientX - bounds.left;

                const localY =
                    event.clientY - bounds.top;

                targetMouseX =
                    localX / bounds.width;

                targetMouseY =
                    1.0 -
                    localY / bounds.height;

                if (!pointerInitialized) {
                    previousPointerX = localX;
                    previousPointerY = localY;
                    pointerInitialized = true;
                }

                const movementX =
                    localX - previousPointerX;

                const movementY =
                    localY - previousPointerY;

                targetVelocityX =
                    movementX / 38;

                targetVelocityY =
                    -movementY / 38;

                const speed =
                    Math.hypot(
                        movementX,
                        movementY
                    );

                targetStrength =
                    Math.min(
                        1,
                        0.26 + speed / 30
                    );

                previousPointerX = localX;
                previousPointerY = localY;
            },
            { passive: true }
        );

        container.addEventListener(
            "pointerenter",
            () => {
                targetStrength = 0.35;
            }
        );

        container.addEventListener(
            "pointerleave",
            () => {
                targetStrength = 0;
                targetVelocityX = 0;
                targetVelocityY = 0;
                pointerInitialized = false;
            }
        );

        const startTime =
            performance.now();

        function render(now) {
            requestAnimationFrame(render);

            if (
                !textureReady ||
                !isVisible
            ) {
                return;
            }

            currentMouseX +=
                (targetMouseX - currentMouseX) *
                0.14;

            currentMouseY +=
                (targetMouseY - currentMouseY) *
                0.14;

            currentVelocityX +=
                (
                    targetVelocityX -
                    currentVelocityX
                ) *
                0.16;

            currentVelocityY +=
                (
                    targetVelocityY -
                    currentVelocityY
                ) *
                0.16;

            currentStrength +=
                (
                    targetStrength -
                    currentStrength
                ) *
                0.10;

            targetVelocityX *= 0.88;
            targetVelocityY *= 0.88;
            targetStrength *= 0.972;

            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.useProgram(program);

            gl.uniform2f(
                uniforms.resolution,
                canvasWidth,
                canvasHeight
            );

            gl.uniform2f(
                uniforms.imageResolution,
                imageWidth,
                imageHeight
            );

            gl.uniform2f(
                uniforms.mouse,
                currentMouseX,
                currentMouseY
            );

            gl.uniform2f(
                uniforms.velocity,
                currentVelocityX,
                currentVelocityY
            );

            gl.uniform1f(
                uniforms.time,
                (now - startTime) / 1000
            );

            gl.uniform1f(
                uniforms.strength,
                currentStrength
            );

            gl.activeTexture(
                gl.TEXTURE0
            );

            gl.bindTexture(
                gl.TEXTURE_2D,
                texture
            );

            gl.uniform1i(
                uniforms.image,
                0
            );

            gl.drawArrays(
                gl.TRIANGLES,
                0,
                6
            );
        }

        requestAnimationFrame(render);
    }

    /* ---------------------------------------------------------
       Contact form
    --------------------------------------------------------- */

    const contactForm =
        document.querySelector("#contactForm");

    const formMessage =
        document.querySelector("#formMessage");

    if (contactForm && formMessage) {
        contactForm.addEventListener(
            "submit",
            (event) => {
                event.preventDefault();

                if (!contactForm.checkValidity()) {
                    formMessage.textContent =
                        "Please complete the required fields.";
                    return;
                }

                formMessage.textContent =
                    "Thank you. Your enquiry is ready to be connected to your email or backend.";

                contactForm.reset();
            }
        );
    }
})();


const stackedProjects =
    document.querySelector("#stackedProjects");

if (stackedProjects) {
    const cards = Array.from(
        stackedProjects.querySelectorAll(".stack-card")
    );

    const dots = Array.from(
        document.querySelectorAll(".stack-dot")
    );

    let activeIndex = 0;
    let hoverTimer = null;

    function updateStack(index) {
        activeIndex = index;

        const totalCards = cards.length;
        const containerWidth =
            stackedProjects.clientWidth;

        const activeWidth =
            containerWidth * 0.55;

        const sideWidth =
            containerWidth * 0.19;

        const gap = 18;

        cards.forEach((card, cardIndex) => {
            const isActive =
                cardIndex === activeIndex;

            card.classList.toggle(
                "active",
                isActive
            );

            if (isActive) {
                card.style.left = "0px";
                card.style.zIndex = "30";
                return;
            }

            const relativePosition =
                cardIndex > activeIndex
                    ? cardIndex - activeIndex
                    : totalCards -
                      activeIndex +
                      cardIndex;

            const visibleStep =
                sideWidth * 0.42 + gap;

            const leftPosition =
                activeWidth +
                gap +
                (relativePosition - 1) *
                visibleStep;

            card.style.left =
                `${leftPosition}px`;

            card.style.zIndex =
                String(30 - relativePosition);
        });

        dots.forEach((dot, dotIndex) => {
            dot.classList.toggle(
                "active",
                dotIndex === activeIndex
            );
        });
    }

    cards.forEach((card, index) => {
        card.addEventListener(
            "mouseenter",
            () => {
                const canHover =
                    window.matchMedia(
                        "(hover: hover) and (pointer: fine)"
                    ).matches;

                if (
                    !canHover ||
                    index === activeIndex
                ) {
                    return;
                }

                clearTimeout(hoverTimer);

                hoverTimer =
                    setTimeout(() => {
                        updateStack(index);
                    }, 1000);
            }
        );

        card.addEventListener(
            "mouseleave",
            () => {
                clearTimeout(hoverTimer);
                hoverTimer = null;
            }
        );

        card.addEventListener(
            "click",
            event => {
                clearTimeout(hoverTimer);

                /*
                 * Small card:
                 * show it immediately.
                 */
                if (index !== activeIndex) {
                    event.preventDefault();
                    updateStack(index);
                }

                /*
                 * Active card:
                 * its normal link opens.
                 */
            }
        );

        card.addEventListener(
            "focusin",
            () => {
                clearTimeout(hoverTimer);
                updateStack(index);
            }
        );
    });

    dots.forEach((dot, index) => {
        dot.addEventListener(
            "click",
            () => {
                clearTimeout(hoverTimer);
                updateStack(index);
            }
        );

        dot.addEventListener(
            "mouseenter",
            () => {
                clearTimeout(hoverTimer);

                hoverTimer =
                    setTimeout(() => {
                        updateStack(index);
                    }, 1000);
            }
        );

        dot.addEventListener(
            "mouseleave",
            () => {
                clearTimeout(hoverTimer);
            }
        );
    });

    window.addEventListener(
        "resize",
        () => updateStack(activeIndex)
    );

    updateStack(0);
}