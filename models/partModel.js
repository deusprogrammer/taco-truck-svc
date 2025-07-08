const mongoose = require('mongoose');

const TransformSchema = new mongoose.Schema({
  rotate: { type: Number, default: 0 },
  skewX: { type: Number, default: 0 },
  skewY: { type: Number, default: 0 },
  translate: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 }
  },
  scale: {
    x: { type: Number, default: 1 },
    y: { type: Number, default: 1 }
  }
}, { _id: false });

const PathDataChildSchema = new mongoose.Schema({
  stroke: String,
  strokeWidth: mongoose.Schema.Types.Mixed,
  fill: String,
  type: String,
  d: String,
  transform: TransformSchema,
  // Common SVG attributes
  x: Number,
  y: Number,
  width: Number,
  height: Number,
  rx: Number,
  ry: Number,
  cx: Number,
  cy: Number,
  r: Number,
  points: [mongoose.Schema.Types.Mixed], // can be [{x, y}] or [[x, y]]
  opacity: Number,
  fillOpacity: Number,
  strokeOpacity: Number,
  strokeDasharray: String,
  strokeLinecap: String,
  strokeLinejoin: String,
  strokeMiterlimit: Number,
  strokeDashoffset: Number,
  // Allow for nested children
  children: [this]
}, { _id: false });

const PathDataSchema = new mongoose.Schema({
  header: {
    width: String,
    height: String,
    viewBox: {
      x: Number,
      y: Number,
      width: Number,
      height: Number
    }
  },
  children: [PathDataChildSchema]
}, { _id: false });

const PartSchema = new mongoose.Schema({
    name: String,
    shape: String,
    size: [Number],
    rim: Number,
    pathData: PathDataSchema,
    owner: String
});

module.exports = mongoose.model('Part', PartSchema);