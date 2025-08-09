import { app } from "../../scripts/app.js";
import { ColorWheelWidget } from "./color_wheel_widget.js";
import { SliderWidget } from "./strength_slider_widget.js";

export const SLIDER_WIDTH = 120;
export const WHEEL_DIAMETER = 120;

const DEFAULT_LGG = {
  lift: { hue: 0.0, sat: 0.0, strength: 1.0, luma: 0.0 },
  gamma: { hue: 0.0, sat: 0.0, strength: 1.0, luma: 0.0 },
  gain: { hue: 0.0, sat: 0.0, strength: 1.0, luma: 0.0 },
};

function removeInputs(node, filter) {
  if (
    !node ||
    node.type !== "OlmLGG" ||
    node.id === -1 ||
    !Array.isArray(node.inputs)
  )
    return;

  for (let i = node.inputs.length - 1; i >= 0; i--) {
    const input = node.inputs[i];
    if (filter(input)) {
      node.removeInput(i);
    }
  }
}

app.registerExtension({
  name: "olm.color.lgg",
  async beforeRegisterNodeDef(nodeType, nodeData, app) {
    if (nodeData.name === "OlmLGG") {
      const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
      const originalOnDrawForeground = nodeType.prototype.onDrawForeground;
      const originalOnConfigure = nodeType.prototype.onConfigure;

      nodeType.prototype.onNodeCreated = function () {
        originalOnNodeCreated?.call(this);

        this.resizable = true;
        this.properties = this.properties || {};
        if (!this.properties.lgg_values) {
          this.properties.lgg_values = JSON.parse(JSON.stringify(DEFAULT_LGG));
        }

        this.widgets.forEach((w) => {
          if (w.name.endsWith("_hue") || w.name.endsWith("_sat")) {
            w.hidden = true;
            w.computeSize = function () {
              return [0, -4];
            };
          }
        });

        this.updateLGGValue = (type, values) => {
          if (!this.properties.lgg_values[type]) return;

          const prev = { ...this.properties.lgg_values[type] };
          Object.assign(this.properties.lgg_values[type], values);

          for (const key in values) {
            const widgetName = `${type}_${key}`;
            const widget = this.widgets.find((w) => w.name === widgetName);
            if (widget && widget.value !== values[key]) {
              widget.value = values[key];
            }
          }
          this.setDirtyCanvas(true, true);
        };

        this.custom_widgets = [];

        const createWheel = (name) => {
          return new ColorWheelWidget(
            this,
            `${name}_ColorWheel`,
            this.properties.lgg_values[name],
            (v) => this.updateLGGValue(name, { hue: v.hue, sat: v.sat })
          );
        };

        this.liftWheel = createWheel("lift");
        this.gammaWheel = createWheel("gamma");
        this.gainWheel = createWheel("gain");

        this.custom_widgets.push(
          this.liftWheel,
          this.gammaWheel,
          this.gainWheel
        );

        const createSlider = (name) => {
          return new SliderWidget(
            this,
            `${name}_StrengthSlider`,
            this.properties.lgg_values[name].strength,
            (val) => this.updateLGGValue(name, { strength: val }),
            name.toLowerCase().includes("gamma") ? 0.1 : 0,
            2.0,
            SLIDER_WIDTH
          );
        };

        this.liftSlider = createSlider("lift");
        this.gammaSlider = createSlider("gamma");
        this.gainSlider = createSlider("gain");

        this.custom_widgets.push(
          this.liftSlider,
          this.gammaSlider,
          this.gainSlider
        );

        const createLumaSlider = (wheelName) => {
          return new SliderWidget(
            this,
            `${wheelName}_LumaSlider`,
            this.properties.lgg_values[wheelName].luma,
            (val) => this.updateLGGValue(wheelName, { luma: val }),
            -1.0,
            1.0,
            SLIDER_WIDTH,
            "Luminosity"
          );
        };

        this.liftLumaSlider = createLumaSlider("lift");
        this.gammaLumaSlider = createLumaSlider("gamma");
        this.gainLumaSlider = createLumaSlider("gain");

        this.custom_widgets.push(
          this.liftLumaSlider,
          this.gammaLumaSlider,
          this.gainLumaSlider
        );

        this.onWidgetChanged = (name, value, prev_value) => {
          if (!name || name === undefined) return;

          if (name.endsWith("_strength")) {
            const type = name.split("_")[0];
            if (
              this[`${type}Slider`] &&
              typeof this[`${type}Slider`].setValue === "function"
            ) {
              this[`${type}Slider`].setValue(value, true);
              this.properties.lgg_values[type].strength = value;
              this.setDirtyCanvas(true, true);
            }
          }

          if (name.endsWith("_luma")) {
            const type = name.split("_")[0];
            const slider = this[`${type}LumaSlider`];
            if (slider && typeof slider.setValue === "function") {
              slider.setValue(value, true);
              if (this.properties.lgg_values?.[type]) {
                this.properties.lgg_values[type].luma = value;
              }
              this.setDirtyCanvas(true, true);
            }
          }

          return value;
        };

        this.addWidget("button", "Reset Adjustments", "reset", () => {
          const confirmed = window.confirm(
            "Are you sure you want to reset the color adjustments?"
          );
          if (confirmed) {
            const debugReset = {};

            for (const key of ["lift", "gamma", "gain"]) {
              const defaults = DEFAULT_LGG[key];

              this.updateLGGValue(key, {
                hue: defaults.hue,
                sat: defaults.sat,
                strength: defaults.strength,
                luma: defaults.luma,
              });

              const strengthWidget = this.widgets.find(
                (w) => w.name === `${key}_strength`
              );
              if (strengthWidget) {
                strengthWidget.value = defaults.strength;
              }

              const wheel = this[`${key}Wheel`];
              if (wheel) {
                wheel.value.hue = defaults.hue;
                wheel.value.sat = defaults.sat;
              }

              const slider = this[`${key}Slider`];
              if (slider && typeof slider.setValue === "function") {
                slider.setValue(defaults.strength, true);
              }

              const lumaSlider = this[`${key}LumaSlider`];
              if (lumaSlider && typeof lumaSlider.setValue === "function") {
                lumaSlider.setValue(defaults.luma, true);
              }

              debugReset[key] = { ...defaults };
            }

            this.setDirtyCanvas(true, true);
          }
        });

        this.setDirtyCanvas(true, true);
      };

      nodeType.prototype.computeSize = function (out) {
        let size = LiteGraph.LGraphNode.prototype.computeSize.call(this, out);
        const minWidth = WHEEL_DIAMETER * 3 + 80;
        const minHeight = WHEEL_DIAMETER + 360;
        size[0] = Math.max(minWidth, size[0]);
        size[1] = Math.max(minHeight, size[1]);
        return size;
      };

      nodeType.prototype.onDrawForeground = function (ctx) {
        originalOnDrawForeground?.call(this, ctx);
        if (this.flags.collapsed) return;

        ctx.save();
        ctx.font = "14px Arial";
        ctx.fillStyle = "#ccc";
        ctx.textAlign = "center";

        const padding = 20;
        const sectionWidth = WHEEL_DIAMETER + padding;
        const startX = (this.size[0] - (sectionWidth * 3 - padding)) / 2;

        const widgetHeight = this.widgets
          .filter((w) => w.type !== "hidden" && w.computeSize)
          .reduce((acc, w) => acc + w.computeSize([this.size[0]])[1], 0);

        const wheelY = widgetHeight + 250;

        const wheels = [this.liftWheel, this.gammaWheel, this.gainWheel];
        const labels = ["Lift", "Gamma", "Gain"];

        for (let i = 0; i < wheels.length; i++) {
          const wheel = wheels[i];
          if (!wheel) continue;

          const label = labels[i];
          const sectionX = startX + i * sectionWidth;
          const centerX = sectionX + WHEEL_DIAMETER / 2;

          ctx.fillText(label, centerX, wheelY - 10);
          wheel.x = sectionX;
          wheel.y = wheelY;

          ctx.save();
          ctx.translate(wheel.x, wheel.y);
          wheel.draw(ctx);
          ctx.restore();
        }

        const sliders = [this.liftSlider, this.gammaSlider, this.gainSlider];
        for (let i = 0; i < sliders.length; i++) {
          const slider = sliders[i];
          if (!slider) continue;

          const sectionX = startX + i * sectionWidth;
          const sliderY = wheelY + WHEEL_DIAMETER + 10;

          slider.x = sectionX;
          slider.y = sliderY;

          ctx.save();
          ctx.translate(slider.x, slider.y);
          slider.draw(ctx);
          ctx.restore();
        }

        const lumaSliders = [
          this.liftLumaSlider,
          this.gammaLumaSlider,
          this.gainLumaSlider,
        ];

        for (let i = 0; i < lumaSliders.length; i++) {
          const slider = lumaSliders[i];
          if (!slider) continue;

          const sectionX = startX + i * sectionWidth;
          const sliderY = wheelY + WHEEL_DIAMETER + 60;

          slider.x = sectionX;
          slider.y = sliderY;

          ctx.save();
          ctx.translate(slider.x, slider.y);
          slider.draw(ctx);
          ctx.restore();
        }

        ctx.restore();
      };

      nodeType.prototype.onConfigure = function (info) {
        originalOnConfigure?.call(this, info);

        if (this.properties.lgg_values) {
          for (const type in this.properties.lgg_values) {
            const values = this.properties.lgg_values[type];

            const wheel = this[`${type}Wheel`];
            if (wheel) {
              Object.assign(wheel.value, values);
            }

            const slider = this[`${type}Slider`];
            if (slider && typeof slider.setValue === "function") {
              slider.setValue(values.strength ?? 0.0, true);
            }

            const lumaSlider = this[`${type}LumaSlider`];
            if (lumaSlider && typeof lumaSlider.setValue === "function") {
              lumaSlider.setValue(values.luma ?? 0.0, true);
            }
          }
        }

        removeInputs(this, (input) => input.type === "FLOAT");

        this.setDirtyCanvas(true, true);
      };

      nodeType.prototype.onAdded = function () {
        const node = this;

        const originalOnMouseDown = node.onMouseDown;
        const originalOnMouseMove = node.onMouseMove;
        const originalOnMouseUp = node.onMouseUp;
        const originalOnMouseLeave = node.onMouseLeave;

        node.onMouseDown = function (event, localPos, graphCanvas) {
          if (originalOnMouseDown?.call(this, event, localPos, graphCanvas))
            return true;
          if (this.custom_widgets) {
            for (const w of this.custom_widgets) {
              if (w.onMouseDown?.(event, localPos)) return true;
            }
          }
          return false;
        };

        node.onMouseMove = function (event, localPos, graphCanvas) {
          if (originalOnMouseMove?.call(this, event, localPos, graphCanvas))
            return true;
          if (this.custom_widgets) {
            for (const w of this.custom_widgets) {
              if (w.onMouseMove?.(event, localPos)) return true;
            }
          }
          return false;
        };

        node.onMouseUp = function (event, localPos, graphCanvas) {
          if (originalOnMouseUp?.call(this, event, localPos, graphCanvas))
            return true;
          if (this.custom_widgets) {
            for (const w of this.custom_widgets) {
              if (w.onMouseUp?.(event, localPos)) return true;
            }
          }
          return false;
        };

        node.onMouseLeave = function (event, localPos, graphCanvas) {
          if (originalOnMouseLeave?.call(this, event, localPos, graphCanvas))
            return true;
          if (this.custom_widgets) {
            for (const w of this.custom_widgets) {
              if (w.onMouseUp?.(event, localPos)) {
                return true;
              }
            }
          }
          return false;
        };

        removeInputs(this, (input) => input.type === "FLOAT");
        this.setDirtyCanvas(true, true);
      };

    }
  },
});
