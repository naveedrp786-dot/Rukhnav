"use strict";

/*
 * RUKHNAV Customer Image Optimizer
 *
 * Shared browser-side optimization for customer-uploaded
 * photos such as review pictures and return evidence.
 *
 * Backend upload limits remain the final safety barrier.
 */

(function () {
    const DEFAULT_MAX_DIMENSION = 1600;
    const DEFAULT_TARGET_BYTES =
        4 * 1024 * 1024;

    const SUPPORTED_TYPES =
        new Set([
            "image/jpeg",
            "image/png",
            "image/webp"
        ]);

    function loadImage(file) {
        return new Promise(
            (resolve, reject) => {
                const image =
                    new Image();

                const url =
                    URL.createObjectURL(
                        file
                    );

                image.onload = () => {
                    URL.revokeObjectURL(
                        url
                    );

                    resolve(image);
                };

                image.onerror = () => {
                    URL.revokeObjectURL(
                        url
                    );

                    reject(
                        new Error(
                            "Unable to read the selected image."
                        )
                    );
                };

                image.src = url;
            }
        );
    }

    function canvasBlob(
        canvas,
        type,
        quality
    ) {
        return new Promise(
            (resolve, reject) => {
                canvas.toBlob(
                    blob => {
                        if (!blob) {
                            reject(
                                new Error(
                                    "Unable to optimize the selected image."
                                )
                            );

                            return;
                        }

                        resolve(blob);
                    },
                    type,
                    quality
                );
            }
        );
    }

    function outputName(file) {
        const original =
            String(
                file?.name ||
                "customer-photo"
            );

        const base =
            original.replace(
                /\.[^.]+$/,
                ""
            ) || "customer-photo";

        return `${base}.jpg`;
    }

    async function optimizeImage(
        file,
        options = {}
    ) {
        if (
            !(file instanceof File) ||
            !SUPPORTED_TYPES.has(
                file.type
            )
        ) {
            return file;
        }

        const maxDimension =
            Number(
                options.maxDimension
            ) ||
            DEFAULT_MAX_DIMENSION;

        const targetBytes =
            Number(
                options.targetBytes
            ) ||
            DEFAULT_TARGET_BYTES;

        /*
         * A small image that is already safely
         * below the upload target does not need
         * to be recompressed.
         */
        if (
            file.size <= targetBytes &&
            options.force !== true
        ) {
            return file;
        }

        const image =
            await loadImage(file);

        let width =
            image.naturalWidth ||
            image.width;

        let height =
            image.naturalHeight ||
            image.height;

        if (
            !width ||
            !height
        ) {
            throw new Error(
                "Unable to determine image dimensions."
            );
        }

        const longestSide =
            Math.max(
                width,
                height
            );

        if (
            longestSide >
            maxDimension
        ) {
            const scale =
                maxDimension /
                longestSide;

            width =
                Math.max(
                    1,
                    Math.round(
                        width * scale
                    )
                );

            height =
                Math.max(
                    1,
                    Math.round(
                        height * scale
                    )
                );
        }

        const canvas =
            document.createElement(
                "canvas"
            );

        canvas.width = width;
        canvas.height = height;

        const context =
            canvas.getContext(
                "2d",
                {
                    alpha: false
                }
            );

        if (!context) {
            throw new Error(
                "Image optimization is not supported on this device."
            );
        }

        /*
         * JPEG has no transparency.
         * White avoids black backgrounds when
         * a PNG/WEBP contains transparent areas.
         */
        context.fillStyle =
            "#ffffff";

        context.fillRect(
            0,
            0,
            width,
            height
        );

        context.drawImage(
            image,
            0,
            0,
            width,
            height
        );

        let quality = 0.86;

        let blob =
            await canvasBlob(
                canvas,
                "image/jpeg",
                quality
            );

        while (
            blob.size >
                targetBytes &&
            quality > 0.5
        ) {
            quality =
                Math.max(
                    0.5,
                    quality - 0.08
                );

            blob =
                await canvasBlob(
                    canvas,
                    "image/jpeg",
                    quality
                );
        }

        if (
            blob.size >
            targetBytes
        ) {
            throw new Error(
                "This image is still too large after optimization. Please choose a smaller photo."
            );
        }

        return new File(
            [blob],
            outputName(file),
            {
                type:
                    "image/jpeg",
                lastModified:
                    Date.now()
            }
        );
    }

    async function optimizeFiles(
        files,
        options = {}
    ) {
        const result = [];

        for (
            const file of
            Array.from(files || [])
        ) {
            /*
             * Videos and any other non-image
             * media pass through unchanged.
             */
            if (
                !String(
                    file?.type || ""
                ).startsWith(
                    "image/"
                )
            ) {
                result.push(file);
                continue;
            }

            result.push(
                await optimizeImage(
                    file,
                    options
                )
            );
        }

        return result;
    }

    window.RukhnavCustomerImages = {
        optimizeImage,
        optimizeFiles,
        supportedTypes:
            SUPPORTED_TYPES
    };
})();
