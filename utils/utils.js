const { CIRCLE, SQUARE } = require('../data/parts.table');
const makerjs = require('makerjs');

const removeUnits = (str) => {
    return parseFloat(str.replace(/[a-zA-Z%]+$/, ''));
}

// Lazy fix for firebase being too primitive to store nested lists 
const convertNestedArraysToObjects = (obj) => {
    if (Array.isArray(obj)) {
        // If this is an array of arrays of numbers, convert to array of objects
        if (
            obj.length > 0 &&
            Array.isArray(obj[0]) &&
            obj[0].length === 2 &&
            obj.every((e) => Array.isArray(e) && e.length === 2)
        ) {
            return obj.map(([x, y]) => ({ x, y }))
        }
        return obj.map(convertNestedArraysToObjects)
    } else if (obj && typeof obj === 'object') {
        Object.keys(obj).forEach((key) => {
            obj[key] = convertNestedArraysToObjects(obj[key])
        })
    }
    return obj
}

// Lazy fix for firebase being too primitive to store nested lists
const convertPointsObjectsToArrays = (obj) => {
    if (Array.isArray(obj)) {
        return obj.map(convertPointsObjectsToArrays)
    } else if (obj && typeof obj === 'object') {
        // Convert points: [{x, y}, ...] => [[x, y], ...]
        if (
            Array.isArray(obj.points) &&
            obj.points.length > 0 &&
            typeof obj.points[0] === 'object' &&
            'x' in obj.points[0] &&
            'y' in obj.points[0]
        ) {
            obj.points = obj.points.map(({ x, y }) => [x, y])
        }
        Object.keys(obj).forEach((key) => {
            obj[key] = convertPointsObjectsToArrays(obj[key])
        })
    }
    return obj
}

const getImageDimensions = (imageUrl) => {
    return new Promise((resolve) => {
        const img = new Image()
        img.onload = () => {
            const width = img.width
            const height = img.height
            resolve([width, height])
        }
        img.src = imageUrl
    })
}

const extractDataUri = (dataUri) => {
    const matches = dataUri.match(/^data:(.*?);base64,(.*)$/);
    if (!matches) {
        throw new Error('Invalid data URI');
    }
    const mimeType = matches[1];
    const base64Payload = matches[2];
    return [mimeType, base64Payload];
};

const storeMedia = async (dataUri, title) => {
    let url = `https://deusprogrammer.com/api/img-svc/media`;
    let [mimeType, imagePayload] = extractDataUri(dataUri);

    let res = await axios.post(url, {mimeType, imagePayload, title});

    return res.data;
}

const replaceUndefined = (obj) => {
    if (Array.isArray(obj)) {
        return obj.map(replaceUndefined);
    } else if (obj !== null && typeof obj === 'object') {
        return Object.keys(obj).reduce((acc, key) => {
            acc[key] = obj[key] === undefined ? 0 : replaceUndefined(obj[key]);
            return acc;
        }, {});
    }
    return obj;
};

const generateUUID = () => {
    let d = new Date().getTime()
    if (typeof performance !== 'undefined' && performance.now) {
        d += performance.now() //use high-precision timer if available
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
        /[xy]/g,
        function (c) {
            let r = (d + Math.random() * 16) % 16 | 0
            d = Math.floor(d / 16)
            return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
        }
    )
}

const calculateRelativePosition = (
    part,
    parts,
    panelWidth,
    panelHeight
) => {
    if (!part || !part.position || !part.origin) {
        return [0, 0, 0, 0]
    }

    const {
        position: [x, y],
        origin: [originX, originY],
        relativeTo,
    } = part
    const relativePart = parts.find(({ id }) => id && relativeTo && id === relativeTo)

    // If this part is relative to another part get the other part and use it's position as an offset
    let offsetX = 0
    let offsetY = 0
    if (relativePart) {
        const [relativeOffsetX, relativeOffsetY] = calculateRelativePosition(
            relativePart,
            parts,
            panelWidth,
            panelHeight
        )
        offsetX += relativeOffsetX
        offsetY += relativeOffsetY
    }

    let anchorAdjustmentX = 0
    let anchorAdjustmentY = 0
    let originCoordX = 0
    let originCoordY = 0
    if (!part.anchor) {
        part.anchor = [0, 0]
    }

    if (!part.dimensions) {
        part.dimensions = [0, 0]
    }

    anchorAdjustmentX = part.anchor[0] * part.dimensions[0]
    anchorAdjustmentY = part.anchor[1] * part.dimensions[1]

    originCoordX = originX * panelWidth
    originCoordY = originY * panelHeight

    return [
        originCoordX + x + offsetX - anchorAdjustmentX,
        originCoordY + y + offsetY - anchorAdjustmentY,
        anchorAdjustmentX,
        anchorAdjustmentY,
    ]
}

const calculateTextPositionAndRotation = (
    lineStartX,
    lineStartY,
    lineEndX,
    lineEndY,
    offset
) => {
    const dx = lineEndX - lineStartX
    const dy = lineEndY - lineStartY
    const angle = Math.atan2(dy, dx)

    const midX = (lineStartX + lineEndX) / 2
    const midY = (lineStartY + lineEndY) / 2

    const offsetX = offset * Math.cos(angle)
    const offsetY = offset * Math.sin(angle)

    return { x: midX + offsetX, y: midY + offsetY, rotation: angle }
}

const normalizePartPositionsToZero = (parts, partTable) => {
    // Find the minimum x and y values
    let minX = Infinity
    let minY = Infinity
    parts.forEach((part) => {
        const position = calculateRelativePosition(part, parts, 0, 0)
        let xAdj = 0
        let yAdj = 0

        // If the part is not a custom part.
        if (part.type && part.type !== 'custom' && part.type !== 'user') {
            const { size, shape } = partTable[part.type][part.partId]
            xAdj = size
            yAdj = size
            if (Array.isArray(size)) {
                xAdj = size[0]
                yAdj = size[1]
            }

            if (shape === CIRCLE) {
                xAdj /= 2
                yAdj /= 2
            }
        }

        minX = Math.min(minX, position[0] - xAdj)
        minY = Math.min(minY, position[1] - yAdj)
    })

    // Normalize each point by subtracting the minimum values
    parts
        .filter(({ relativeTo }) => !relativeTo)
        .forEach((part) => {
            part.position[0] -= minX
            part.position[1] -= minY
        })

    return parts
}

const calculateSizeOfPart = (part, partTable) => {
    // console.log(JSON.stringify(part, null, 5));
    if (!part || part?.type === undefined) {
        return [0, 0];
    }

    if (part.type === 'custom') {
        let minX = Infinity
        let maxX = -Infinity
        let minY = Infinity
        let maxY = -Infinity

        let layout = part.layout
        layout?.parts?.forEach((childPart) => {
            let [x, y] = calculateRelativePosition(
                childPart,
                layout.parts,
                layout.panelDimensions[0],
                layout.panelDimensions[1]
            )

            // If the part is not a custom part.
            let xAdj = 0
            let yAdj = 0
            if (childPart.type && childPart.type !== 'custom' && childPart.type !== 'user') {
                const { size, shape } =
                    partTable?.[childPart.type]?.[childPart?.partId] || {size: 0, shape: CIRCLE}
                xAdj = size
                yAdj = size
                if (Array.isArray(size)) {
                    xAdj = size[0]
                    yAdj = size[1]
                }

                if (shape === CIRCLE) {
                    xAdj /= 2
                    yAdj /= 2
                }
                minX = Math.min(minX, x - xAdj)
                minY = Math.min(minY, y - yAdj)
                maxX = Math.max(maxX, x + xAdj)
                maxY = Math.max(maxY, y + yAdj)
            } else {
                ;[xAdj, yAdj] = calculateSizeOfPart(childPart, partTable)
                minX = Math.min(minX, x)
                minY = Math.min(minY, y)
                maxX = Math.max(maxX, x + xAdj)
                maxY = Math.max(maxY, y + yAdj)
            }
        })

        let width = maxX - minX;
        let height = maxY - minY;

        width = Math.abs(width) === Infinity ? 0 : width
        height = Math.abs(height) === Infinity ? 0 : height

        return [width, height]
    } else if (part.type === 'user') {
        let { width, height, viewBox } = part?.modelTree?.header || { viewBox: {} };
        width = removeUnits(width || "0mm");
        height = removeUnits(height || "0mm");

        if (!width && !height) {
            ({width, height} = viewBox); 
        }
        return [width, height]
    } else {
        let { size } = partTable?.[part.type]?.[part.partId]

        if (Array.isArray(size)) {
            return size
        } else {
            return [size, size]
        }
    }
}

const clean = (arr) => {
    return arr?.map(value => Number(value));
}

const simplify = (layout, parent, partTable) => {
    if (!layout) {
        return null
    }

    const { panelDimensions, type, partId } = layout
    let simplified = { ...layout }
 
    let partsToFlatten = [];
    if (parent) {
        if (type === 'custom') {
            const { parts, panelDimensions } = parent
            const [panelWidth, panelHeight] = clean(panelDimensions) || [0, 0]
            simplified.dimensions = clean(calculateSizeOfPart(layout, partTable)) 
            simplified.position = clean(calculateRelativePosition(
                { ...layout, dimensions: [simplified.dimensions[0], simplified.dimensions[1]] },
                parts,
                panelWidth,
                panelHeight
            )).slice(0, 2)
            delete simplified.panelDimensions
            partsToFlatten = layout.layout.parts

            parent = {
                ...layout.layout,
                panelDimensions: simplified.dimensions
            }
        } else if (type === 'user') {
            const {modelTree, geometry} = partTable.user[partId]
            const { parts, panelDimensions } = parent
            const [panelWidth, panelHeight] = clean(panelDimensions) || [0, 0]
            simplified = { ...simplified, modelTree, geometry }
            simplified.dimensions = clean(calculateSizeOfPart({...layout, modelTree, geometry}, partTable)) 
            simplified.position = clean(calculateRelativePosition(
                { ...layout, dimensions: [simplified.dimensions[0], simplified.dimensions[1]] },
                parts,
                panelWidth,
                panelHeight
            )).slice(0, 2)
            delete simplified.panelDimensions

            parent = {
                ...layout.layout,
                panelDimensions: simplified.dimensions
            }
        } else {
            const { parts, panelDimensions } = parent
            const [panelWidth, panelHeight] = simplified.dimensions = panelDimensions || [0, 0]
            simplified.dimensions = clean(calculateSizeOfPart(layout, partTable))
            simplified.position = clean(calculateRelativePosition(
                layout,
                parts,
                panelWidth,
                panelHeight
            )).slice(0, 2)
            partsToFlatten = null
        }
    } else {
        simplified.panelDimensions = clean(panelDimensions)
        partsToFlatten = layout.parts
        parent = layout;
    }

    simplified.children = [];
    partsToFlatten?.forEach((part) => {
        const simplifiedChild = simplify(part, parent, partTable)
        simplified.children.push(simplifiedChild)
    });

    // Clean up
    delete simplified.origin
    delete simplified.anchor
    delete simplified.layout
    delete simplified.parts

    return simplified
}

const convertPartToPath = ({type, partId, position, rx, ry, cx, cy}, partTable, options = {}) => {
    const { shape, size } = partTable[type]?.[partId] || {};
    const { drillingGuide, buttonEnlargement = 0 } = options;

    // Apply button enlargement only for button type parts
    const enlargement = type === 'button' ? buttonEnlargement : 0;

    switch (shape) {
        case CIRCLE: {
            const model = {
                paths: {
                    circle: new makerjs.paths.Circle(position, (size / 2) + enlargement),
                    hLine: drillingGuide ? new makerjs.paths.Line(
                        [position[0] - size / 2, position[1]],
                        [position[0] + size / 2, position[1]]
                    ) : null,
                    vLine: drillingGuide ? new makerjs.paths.Line(
                        [position[0], position[1] - size / 2],
                        [position[0], position[1] + size / 2]
                    ) : null
                }
            }
            return model;
        }
        case SQUARE: {
            const enlargedWidth = size[0] + (enlargement * 2);
            const enlargedHeight = size[1] + (enlargement * 2);
            const model = new makerjs.models.Rectangle(enlargedWidth, enlargedHeight)
            const [x, y] = position
            model.origin = [x - enlargedWidth/2, y - enlargedHeight/2]
            return model;
        }
        default:
            break;
    }
}

// Multi-layer export constant - enlargement in mm for bottom layer buttons
const BOTTOM_LAYER_BUTTON_ENLARGEMENT = 5;

// Clustering distance threshold - buttons within this distance are considered part of the same cluster
const CLUSTER_DISTANCE_THRESHOLD = 40; // mm

const clusterButtons = (buttons, distanceThreshold) => {
    if (buttons.length === 0) return [];

    const clusters = [];
    const visited = new Set();

    buttons.forEach((button, index) => {
        if (visited.has(index)) return;

        const cluster = [button];
        visited.add(index);

        const queue = [button];
        while (queue.length > 0) {
            const current = queue.shift();
            const [cx, cy] = current.panelPosition || current.position;

            buttons.forEach((other, otherIndex) => {
                if (visited.has(otherIndex)) return;

                const [ox, oy] = other.panelPosition || other.position;
                const distance = Math.sqrt((cx - ox) ** 2 + (cy - oy) ** 2);

                if (distance <= distanceThreshold) {
                    cluster.push(other);
                    visited.add(otherIndex);
                    queue.push(other);
                }
            });
        }

        clusters.push(cluster);
    });

    return clusters;
};

const collectAllButtons = (simplified, targetLayer) => {
    const buttons = [];

    const traverse = (node, offset) => {
        if (!node) return;

        if (node.type === 'button') {
            const partLayer = node.layer || 'both';
            if (!targetLayer || partLayer === 'both' || partLayer === targetLayer) {
                const absPos = [
                    (node.position?.[0] || 0) + offset[0],
                    (node.position?.[1] || 0) + offset[1]
                ];
                buttons.push({ ...node, panelPosition: absPos });
            }
        }

        if (node.children && node.children.length > 0) {
            // Buttons inside a custom part have positions local to that part.
            // Accumulate the custom part's absolute position as an offset for its children.
            const childOffset = node.type === 'custom'
                ? [offset[0] + (node.position?.[0] || 0), offset[1] + (node.position?.[1] || 0)]
                : offset;
            node.children.forEach(child => traverse(child, childOffset));
        }
    };

    traverse(simplified, [0, 0]);
    return buttons;
};

const collectAllVectorParts = (simplified, targetLayer) => {
    const parts = [];

    const traverse = (node, offset) => {
        if (!node) return;

        if (node.type === 'user' || node.type === 'svg') {
            const partLayer = node.layer || 'both';
            if (!targetLayer || partLayer === 'both' || partLayer === targetLayer) {
                const absPos = [
                    (node.position?.[0] || 0) + offset[0],
                    (node.position?.[1] || 0) + offset[1]
                ];
                parts.push({ ...node, panelPosition: absPos });
            }
        }

        if (node.children && node.children.length > 0) {
            const childOffset = node.type === 'custom'
                ? [offset[0] + (node.position?.[0] || 0), offset[1] + (node.position?.[1] || 0)]
                : offset;
            node.children.forEach(child => traverse(child, childOffset));
        }
    };

    traverse(simplified, [0, 0]);
    return parts;
};

const createClusterOutline = (cluster, partTable, offset) => {
    if (cluster.length === 0) return null;

    if (cluster.length === 1) {
        const button = cluster[0];
        const { shape, size } = partTable[button.type]?.[button.partId] || {};
        const [cx, cy] = button.panelPosition || button.position;

        if (shape === CIRCLE) {
            const radius = size / 2 + offset;
            return { paths: { circle: new makerjs.paths.Circle([cx, cy], radius) } };
        } else if (shape === SQUARE) {
            const width = size[0] + offset * 2;
            const height = size[1] + offset * 2;
            const rect = new makerjs.models.Rectangle(width, height);
            rect.origin = [cx - width / 2, cy - height / 2];
            return rect;
        }
    }

    const circles = cluster.map((button) => {
        const { shape, size } = partTable[button.type]?.[button.partId] || {};
        const [cx, cy] = button.panelPosition || button.position;
        if (shape === CIRCLE) {
            return { cx, cy, radius: size / 2 + offset };
        }
        return null;
    }).filter(Boolean);

    if (circles.length < 2) {
        return { paths: { circle: new makerjs.paths.Circle([circles[0].cx, circles[0].cy], circles[0].radius) } };
    }

    const paths = {};
    let pathIndex = 0;

    circles.forEach((circle, i) => {
        const intersectionAngles = [];

        circles.forEach((other, j) => {
            if (i === j) return;

            const dx = other.cx - circle.cx;
            const dy = other.cy - circle.cy;
            const dist = Math.hypot(dx, dy);

            if (dist < circle.radius + other.radius) {
                const angleToOther = Math.atan2(dy, dx);
                const a = circle.radius;
                const b = other.radius;
                const c = dist;

                if (dist > Math.abs(a - b)) {
                    const alpha = Math.acos((a * a + c * c - b * b) / (2 * a * c));
                    intersectionAngles.push({ angle: angleToOther - alpha, type: 'start', otherId: j });
                    intersectionAngles.push({ angle: angleToOther + alpha, type: 'end', otherId: j });
                }
            }
        });

        intersectionAngles.sort((a, b) => a.angle - b.angle);

        if (intersectionAngles.length === 0) {
            paths[`arc_${pathIndex++}`] = new makerjs.paths.Circle([circle.cx, circle.cy], circle.radius);
        } else {
            for (let k = 0; k < intersectionAngles.length; k++) {
                const curr = intersectionAngles[k];
                const next = intersectionAngles[(k + 1) % intersectionAngles.length];

                let midAngle = (curr.angle + next.angle) / 2;
                if (next.angle < curr.angle) midAngle += Math.PI;

                const testX = circle.cx + circle.radius * Math.cos(midAngle);
                const testY = circle.cy + circle.radius * Math.sin(midAngle);

                let isVisible = true;
                for (let j = 0; j < circles.length; j++) {
                    if (i === j) continue;
                    const other = circles[j];
                    const dist = Math.hypot(testX - other.cx, testY - other.cy);
                    if (dist < other.radius - 0.1) {
                        isVisible = false;
                        break;
                    }
                }

                if (isVisible) {
                    let startAngle = curr.angle * (180 / Math.PI);
                    let endAngle = next.angle * (180 / Math.PI);

                    while (endAngle < startAngle) endAngle += 360;

                    const angleDiff = endAngle - startAngle;
                    if (angleDiff > 1 && angleDiff < 359) {
                        paths[`arc_${pathIndex++}`] = new makerjs.paths.Arc(
                            [circle.cx, circle.cy],
                            circle.radius,
                            startAngle,
                            endAngle
                        );
                    }
                }
            }
        }
    });

    const model = { paths };
    const chains = makerjs.model.findChains(model);

    if (chains && chains.length > 0) {
        const clusterCenterX = circles.reduce((sum, c) => sum + c.cx, 0) / circles.length;
        const clusterCenterY = circles.reduce((sum, c) => sum + c.cy, 0) / circles.length;

        const chainScores = chains.map(chain => {
            const chainPaths = {};
            chain.links.forEach((link, idx) => {
                chainPaths[`path_${idx}`] = link.walkedPath.pathContext;
            });
            const chainModel = { paths: chainPaths };
            const bounds = makerjs.measure.modelExtents(chainModel);

            if (!bounds) return { chain, score: -1, area: 0 };

            const centroidX = (bounds.low[0] + bounds.high[0]) / 2;
            const centroidY = (bounds.low[1] + bounds.high[1]) / 2;
            const distToClusterCenter = Math.hypot(centroidX - clusterCenterX, centroidY - clusterCenterY);
            const width = bounds.high[0] - bounds.low[0];
            const height = bounds.high[1] - bounds.low[1];
            const area = width * height;
            const maxRadius = Math.max(...circles.map(c => c.radius));
            const normalizedDist = distToClusterCenter / maxRadius;
            const score = area / (1 + normalizedDist);

            return { chain, score, area };
        });

        chainScores.sort((a, b) => b.score - a.score);

        const maxArea = Math.max(...chainScores.map(cs => cs.area));
        const validChains = chainScores
            .filter(cs => cs.score > 0 && cs.area > maxArea * 0.1)
            .map(cs => cs.chain);

        const outerPaths = {};
        let pathIdx = 0;
        validChains.forEach(chain => {
            chain.links.forEach((link) => {
                outerPaths[`outer_${pathIdx++}`] = link.walkedPath.pathContext;
            });
        });

        return { paths: outerPaths };
    }

    return { paths };
};

const makerifyModelTree = (modelTree, options = {}) => {
    const { header, type, d, width, height, x, y, cx, cy, rx, ry, r, children, transform, graphical, layer } = modelTree || {};
    const { translate, rotate, scale, skewX, skewY } = transform || {};
    const { includeGraphical, targetLayer } = options;
    
    let model = {};

    // Handle layer filtering
    const partLayer = layer || (graphical ? 'none' : 'both');
    if (targetLayer && partLayer !== 'both' && partLayer !== targetLayer) {
        return model;
    }

    if (!includeGraphical && graphical) {
        return model;
    }

    if (header) {
        model = {
            models: {}
        }

        children.forEach((child, index) => {
            model.models[`child-${index}`] = makerifyModelTree(child, options)
        })

        return model;
    }

    if (type === 'path') {
        model = makerjs.importer.fromSVGPathData(d);
    } else if (type === 'group') {
        model = {
            models: {}
        }

        children.forEach((child, index) => {
            model.models[`child-${index}`] = makerifyModelTree(child, options)
        })
    } else if (type === 'rectangle') {
        if (rx && ry) {
            model = new makerjs.models.RoundRectangle(width, height, (rx + ry) / 2);
        } else {
            model = new makerjs.models.Rectangle(width, height);
            model.origin = [x, y];
        }
    } else if (type === 'circle') {
        // Expect radius and origin in the modelTree
        model = {
            paths: {
                circle: new makerjs.paths.Circle([cx, cy], r)
            }
        };
    } else if (type === 'ellipse') {
        // Expect cx, cy, rx, ry in the modelTree
        model = makerjs.model.mirror(new makerjs.models.Ellipse([cx, cy], rx, ry), false, true);
    } else if (type === 'polygon') {
        // modelTree.points is expected to be an array of [x, y] pairs
        if (Array.isArray(modelTree.points) && modelTree.points.length > 1) {
            model = {
                paths: {}
            };
            // Draw lines between each point, and close the shape
            for (let i = 0; i < modelTree.points.length; i++) {
                const start = modelTree.points[i];
                const end = modelTree.points[(i + 1) % modelTree.points.length];
                model.paths[`line-${i}`] = new makerjs.paths.Line(start, end);
            }
        }
        model = makerjs.model.mirror(model, false, true);
    } else if (type === 'polyline') {
        if (Array.isArray(modelTree.points) && modelTree.points.length > 1) {
            model = {
                paths: {}
            };
            // Draw lines between each point, do NOT close the shape
            for (let i = 0; i < modelTree.points.length - 1; i++) {
                const start = modelTree.points[i];
                const end = modelTree.points[i + 1];
                model.paths[`line-${i}`] = new makerjs.paths.Line(start, end);
            }
        }
        model = makerjs.model.mirror(model, false, true);
    } else {
        // Handle other types or return empty model
        model = {};
    }

    if (rotate) {
        model = makerjs.model.rotate(model, rotate, [0, 0]);
    }

    if (scale) {
        model = makerjs.model.distort(model, scale.x, scale.y)
    }

    if (skewX > 0) {
        model = makerjs.model.distort(model, skewX, 1)
    }
    
    if (skewY > 0) {
        model = makerjs.model.distort(model, 1, skewY)
    }

    if (translate) {
        const { x, y } = translate;
        model = makerjs.model.moveRelative(model, [x, -y]);
    }

    return model;
}

const makerify = (simplifiedLayout, parent, partTable, options = {}, layer = 0) => {
    const { panelDimensions, panelModel, type, position, rotation, cornerRadius, children } = simplifiedLayout

    let model = {
        models: {},
        paths: {},
        layer
    };

    if (!parent) {
        parent = simplifiedLayout;
        if (panelModel) {
            model.models.panel = makerjs.model.mirror(makerifyModelTree(panelModel, options), false, true)
        } else {
            if (cornerRadius) {
                model.models.panel = new makerjs.models.RoundRectangle(panelDimensions?.[0], panelDimensions?.[1], cornerRadius)
            } else {
                model.models.panel = new makerjs.models.Rectangle(panelDimensions?.[0], panelDimensions?.[1])
            }
        }
        model.units = simplifiedLayout.units;
    }

    const { targetLayer, buttonEnlargement, useButtonClustering } = options;
    const shouldCluster = useButtonClustering && buttonEnlargement > 0;

    // When clustering, custom parts are transparent - collect their buttons directly
    if (!shouldCluster || parent?.isNested) {
        children.filter((child) => {
            if (child.type !== 'custom') return false;
            const partLayer = child.layer || 'both';
            if (targetLayer && partLayer !== 'both' && partLayer !== targetLayer) return false;
            return true;
        }).forEach((child, index) => {
            model.models[`customs-${index}`] = makerify(child, parent, partTable, options, layer++);
        })
    }

    if (shouldCluster && !parent?.isNested) {
        const allButtons = collectAllButtons(simplifiedLayout, targetLayer);

        if (allButtons.length > 0) {
            const clusters = clusterButtons(allButtons, CLUSTER_DISTANCE_THRESHOLD);

            clusters.forEach((cluster, clusterIndex) => {
                const outline = createClusterOutline(cluster, partTable, buttonEnlargement);
                if (outline) {
                    model.models[`cluster-${clusterIndex}`] = outline;
                }
            });
        }

        // Collect ALL vector parts (user/svg) from entire tree
        const allVectorParts = collectAllVectorParts(simplifiedLayout, targetLayer);
        allVectorParts.forEach((part, index) => {
            const pos = part.panelPosition || part.position || [0, 0];
            let partModel = makerjs.model.mirror(makerifyModelTree(part.modelTree, options), false, true);
            partModel = makerjs.model.rotate(partModel, part.rotation || 0, [0, 0]);
            partModel = makerjs.model.moveRelative(partModel, pos);
            model.models[`vector-${index}`] = partModel;
        });

        // Add non-button, non-vector parts from root level only
        children.filter((child) => {
            if (child.type === 'custom' || child.type === 'button' || child.type === 'user' || child.type === 'svg') return false;
            const partLayer = child.layer || 'both';
            if (targetLayer && partLayer !== 'both' && partLayer !== targetLayer) return false;
            return true;
        }).forEach((child, index) => {
            model.models[`parts-${index}`] = convertPartToPath(child, partTable, options);
        });
    } else {
        // Normal processing without clustering
        children.filter((child) => {
            if (child.type === 'custom' || child.type === 'svg' || child.type === 'user') return false;
            const partLayer = child.layer || 'both';
            if (targetLayer && partLayer !== 'both' && partLayer !== targetLayer) return false;
            return true;
        }).forEach((child, index) => {
            model.models[`parts-${index}`] = convertPartToPath(child, partTable, options);
        })
    }

    if (!shouldCluster || parent?.isNested) children.filter((child) => {
            if (child.type !== 'user') return false;
            const partLayer = child.layer || 'both';
            if (targetLayer && partLayer !== 'both' && partLayer !== targetLayer) return false;
            return true;
        }).forEach((child, index) => {
            const [x, y] = child.position;
            let userModel = makerjs.model.mirror(makerifyModelTree(child.modelTree, options), false, true);
            userModel = makerjs.model.rotate(userModel, child.rotation || 0, [0, 0]);
            userModel = makerjs.model.moveRelative(userModel, [x, y]);
            model.models[`user-parts-${index}`] = userModel;
        })

    if (parent) {
        if (type === 'custom') {
            const [x, y] = position;
            model = makerjs.model.rotate(model, rotation, [0, 0]);
            model = makerjs.model.moveRelative(model, [x, y]);
        }
    }

    return model;
}

module.exports = {
    BOTTOM_LAYER_BUTTON_ENLARGEMENT,
    convertNestedArraysToObjects,
    convertPointsObjectsToArrays,
    getImageDimensions,
    extractDataUri,
    replaceUndefined,
    generateUUID,
    calculateRelativePosition,
    calculateTextPositionAndRotation,
    normalizePartPositionsToZero,
    calculateSizeOfPart,
    simplify,
    convertPartToPath,
    makerifyModelTree,
    makerify,
};