import { WHEEL_DIAMETER } from "./olm_lgg.js";

const PI2 = Math.PI * 2;

export class SliderWidget {
  constructor(
    node,
    name,
    value,
    callback,
    min = 0.0,
    max = 2.0,
    sliderWidth = 120,
    label = "Strength"
  ) {
    this.node = node;
    this.name = name;
    this.value = value;
    this.callback = callback;
    this.min = min;
    this.max = max;
    this.label = label;
    this.dragging = false;
    this.x = 0;
    this.y = 0;
    this.width = sliderWidth;
    this.height = 20;
  }

  draw(ctx) {
    const sliderWidth = this.width;
    const sliderHeight = 6;
    const knobRadius = 6;
    const x = WHEEL_DIAMETER / 2.0 - sliderWidth / 2.0;
    const y = 0;
    const labelOffset = 40;
    const labelX = WHEEL_DIAMETER / 2.0 - labelOffset / 2.0;
    const labelY = 10;
    ctx.font = "10px Arial";
    ctx.fillStyle = "#eee";
    ctx.textAlign = "left";
    ctx.fillText(this.label, labelX, labelY);
    ctx.fillStyle = "#444";
    ctx.fillRect(x, y + 40, sliderWidth, sliderHeight);
    const normalizedValue = (this.value - this.min) / (this.max - this.min);
    const knobX = x + normalizedValue * sliderWidth;
    ctx.beginPath();
    ctx.arc(knobX, y + sliderHeight / 2 + 40, knobRadius, 0, PI2);
    ctx.fillStyle = "#ddd";
    ctx.fill();
    ctx.strokeStyle = "#000";
    ctx.stroke();
    ctx.font = "12px Arial";
    ctx.fillStyle = "#ccc";
    ctx.textAlign = "center";
    ctx.fillText(
      this.value.toFixed(2),
      x + sliderWidth / 2.0,
      sliderHeight + 25
    );
  }

  onMouseUp(event, localPos) {
    if (this.dragging) {
      this.dragging = false;
      this.node.setDirtyCanvas(true, true);
      return true;
    }
    return false;
  }

  onMouseDown(event, localPos) {
    const { x, y } = this.getLocalMouse(localPos);
    const knobRadius = 6;
    const withinHeight = y >= 30 && y <= this.height + knobRadius + 30;
    if (x >= -knobRadius && x <= this.width + knobRadius && withinHeight) {
      this.dragging = true;
      this.updateValue(x);
      this.node.setDirtyCanvas(true, true);
      return true;
    }
    return false;
  }

  onMouseMove(event, localPos) {
    if (!this.dragging) return false;
    if (event.buttons !== 1) {
      this.onMouseUp();
      return false;
    }
    const { x } = this.getLocalMouse(localPos);
    this.updateValue(x);
    this.node.setDirtyCanvas(true, true);
    return true;
  }

  getLocalMouse(localPos) {
    return {
      x: localPos[0] - this.x,
      y: localPos[1] - this.y,
    };
  }

  updateValue(x) {
    const clampedPixelX = Math.max(0, Math.min(x, this.width));
    const normalizedPixel = clampedPixelX / this.width;
    this.value = normalizedPixel * (this.max - this.min) + this.min;
    this.value = Math.max(this.min, Math.min(this.value, this.max));
    if (this.callback) {
      this.callback(this.value);
    }
  }

  setValue(newValue, silent = false) {
    this.value = Math.max(this.min, Math.min(newValue, this.max));
    if (!silent && this.callback) {
      this.callback(this.value);
    }
    this.node.setDirtyCanvas(true, true);
  }
}
