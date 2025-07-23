const OUTER_RADIUS = 60;
const INNER_RADIUS = 40;
const ROTATION_OFFSET = -Math.PI / 2;
const SEGMENT_OVERLAP = 0.002;
const JOYSTICK_RADIUS = INNER_RADIUS - 5;
const PI2 = Math.PI * 2;

function polarToCartesian(radius, angle) {
  return {
    x: radius * Math.cos(angle),
    y: radius * Math.sin(angle),
  };
}

export class ColorWheelWidget {
  constructor(node, name, value, callback) {
    this.node = node;
    this.name = name;
    this.value = value;
    this.callback = callback;
    this.x = 0;
    this.y = 0;
    this.dragging = false;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(OUTER_RADIUS, OUTER_RADIUS);
    for (let i = 0; i < 360; i++) {
      const startAngle = (i * Math.PI) / 180 + ROTATION_OFFSET;
      const endAngle = ((i + 1) * Math.PI) / 180 + ROTATION_OFFSET;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(
        0,
        0,
        OUTER_RADIUS,
        startAngle - SEGMENT_OVERLAP,
        endAngle + SEGMENT_OVERLAP,
        false
      );
      ctx.closePath();
      ctx.fillStyle = `hsl(${i}, 100%, 50%)`;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, 0, INNER_RADIUS, 0, PI2);
    ctx.fillStyle = "#2a2a2a";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, JOYSTICK_RADIUS, 0, PI2);
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-JOYSTICK_RADIUS, 0);
    ctx.lineTo(JOYSTICK_RADIUS, 0);
    ctx.moveTo(0, -JOYSTICK_RADIUS);
    ctx.lineTo(0, JOYSTICK_RADIUS);
    ctx.stroke();
    const angle = this.value.hue * PI2 + ROTATION_OFFSET;
    const radius = this.value.sat * JOYSTICK_RADIUS;
    const puckPos = polarToCartesian(radius, angle);
    ctx.beginPath();
    ctx.arc(puckPos.x, puckPos.y, 6, 0, PI2);
    ctx.fillStyle = "white";
    ctx.fill();
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  onMouseDown(event, localPos) {
    const { x, y } = this.getLocalMouse(localPos);
    const dist = Math.sqrt(x * x + y * y);
    if (dist <= JOYSTICK_RADIUS) {
      this.dragging = true;
      this.updateValue(x, y);
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
    if (this.dragging) {
      const { x, y } = this.getLocalMouse(localPos);
      this.updateValue(x, y);
      this.node.setDirtyCanvas(true, true);
      return true;
    }
    return false;
  }

  onMouseUp() {
    if (this.dragging) {
      this.dragging = false;
      this.node.setDirtyCanvas(true, true);
      return true;
    }
    return false;
  }

  getLocalMouse(localPos) {
    return {
      x: localPos[0] - (this.x + OUTER_RADIUS),
      y: localPos[1] - (this.y + OUTER_RADIUS),
    };
  }

  updateValue(x, y) {
    const dist = Math.sqrt(x * x + y * y);
    const clampedDist = Math.min(dist, JOYSTICK_RADIUS);
    let angle = Math.atan2(y, x) - ROTATION_OFFSET;
    if (angle < 0) angle += PI2;
    this.value.hue = angle / PI2;
    this.value.sat = clampedDist / JOYSTICK_RADIUS;
    if (this.callback) {
      this.callback(this.value);
    }
  }
}
