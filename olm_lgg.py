import torch
import numpy as np

DEBUG_MODE = False


def debug_print(*args, **kwargs):
    if DEBUG_MODE:
        print(*args, **kwargs)


DEFAULT_LGG = {
    "lift": {"hue": 0.0, "sat": 0.0, "strength": 1.0, "luma": 0.0},
    "gamma": {"hue": 0.0, "sat": 0.0, "strength": 1.0, "luma": 0.0},
    "gain": {"hue": 0.0, "sat": 0.0, "strength": 1.0, "luma": 0.0},
}


def hsl_to_lift_rgb(hue, sat, strength):
    angle = hue * 2 * np.pi
    r = np.cos(angle) * sat
    g = np.cos(angle - (2 * np.pi / 3)) * sat
    b = np.cos(angle + (2 * np.pi / 3)) * sat
    return [
        r * strength * 0.5,
        g * strength * 0.5,
        b * strength * 0.5
    ]


def hsl_to_gamma_rgb(hue, sat, strength):
    angle = hue * 2 * np.pi
    r = np.cos(angle) * sat
    g = np.cos(angle - (2 * np.pi / 3)) * sat
    b = np.cos(angle + (2 * np.pi / 3)) * sat
    return [
        max(0.1, 1.0 + r * (strength - 1.0) * 2),
        max(0.1, 1.0 + g * (strength - 1.0) * 2),
        max(0.1, 1.0 + b * (strength - 1.0) * 2)
    ]


def hsl_to_gain_rgb(hue, sat, strength):
    angle = hue * 2 * np.pi
    r = np.cos(angle) * sat
    g = np.cos(angle - (2 * np.pi / 3)) * sat
    b = np.cos(angle + (2 * np.pi / 3)) * sat
    return [
        1.0 + r * strength,
        1.0 + g * strength,
        1.0 + b * strength
    ]


def apply_lift_gamma_gain(image_tensor, lift_params, gamma_params, gain_params):
    device = image_tensor.device
    result = image_tensor.clone()

    lift_rgb = hsl_to_lift_rgb(lift_params['hue'], lift_params['sat'], lift_params['strength'])
    gamma_rgb = hsl_to_gamma_rgb(gamma_params['hue'], gamma_params['sat'], gamma_params['strength'])
    gain_rgb = hsl_to_gain_rgb(gain_params['hue'], gain_params['sat'], gain_params['strength'])

    lift_tensor = torch.tensor(lift_rgb, device=device, dtype=image_tensor.dtype).view(1, 1, 1, 3)
    gamma_tensor = torch.tensor(gamma_rgb, device=device, dtype=image_tensor.dtype).view(1, 1, 1, 3)
    gain_tensor = torch.tensor(gain_rgb, device=device, dtype=image_tensor.dtype).view(1, 1, 1, 3)

    lift_luma_tensor = torch.tensor(lift_params.get("luma", 0.0), device=device).view(1, 1, 1, 1)
    gamma_luma_tensor = torch.tensor(gamma_params.get("luma", 0.0), device=device).view(1, 1, 1, 1)
    gain_luma_tensor = torch.tensor(gain_params.get("luma", 0.0), device=device).view(1, 1, 1, 1)

    result = result + lift_tensor + lift_luma_tensor
    result = torch.pow(torch.clamp(result, min=0.001), 1.0 / torch.clamp(gamma_tensor, min=0.001))
    result = result + gamma_luma_tensor
    result = result * gain_tensor
    result = result + gain_luma_tensor
    result = torch.clamp(result, 0.0, 1.0)
    return result


class OlmLGG:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "lift_hue": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 1.0, "step": 0.001}),
                "lift_sat": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 1.0, "step": 0.001}),
                "lift_strength": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 2.0, "step": 0.01}),
                "lift_luma": ("FLOAT", {"default": 0.0, "min": -1.0, "max": 1.0, "step": 0.01}),
                "gamma_hue": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 1.0, "step": 0.001}),
                "gamma_sat": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 1.0, "step": 0.001}),
                "gamma_strength": ("FLOAT", {"default": 1.0, "min": 0.1, "max": 2.0, "step": 0.01}),
                "gamma_luma": ("FLOAT", {"default": 0.0, "min": -1.0, "max": 1.0, "step": 0.01}),
                "gain_hue": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 1.0, "step": 0.001}),
                "gain_sat": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 1.0, "step": 0.001}),
                "gain_strength": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 2.0, "step": 0.01}),
                "gain_luma": ("FLOAT", {"default": 0.0, "min": -1.0, "max": 1.0, "step": 0.01}),
            },
            "hidden": {
                "node_id": "UNIQUE_ID",
            }
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "apply_color_adjustments"
    CATEGORY = "image/color"


    def apply_color_adjustments(
        self,
        image: torch.Tensor,
        lift_hue: float, lift_sat: float, lift_strength: float, lift_luma: float,
        gamma_hue: float, gamma_sat: float, gamma_strength: float, gamma_luma: float,
        gain_hue: float, gain_sat: float, gain_strength: float, gain_luma: float,
        node_id=None,
    ):
        debug_print("=" * 60)
        debug_print(f"[OlmLGG] Node {node_id} executed (Backend)")

        debug_print("\n[OlmLGG] [Input Parameters]")
        debug_print(f"[Lift] H={lift_hue:.3f}, S={lift_sat:.3f}, Str={lift_strength:.3f}, Luma={lift_luma:.3f}")
        debug_print(f"[Gamma] H={gamma_hue:.3f}, S={gamma_sat:.3f}, Str={gamma_strength:.3f}, Luma={gamma_luma:.3f}")
        debug_print(f"[Gain] H={gain_hue:.3f}, S={gain_sat:.3f}, Str={gain_strength:.3f}, Luma={gain_luma:.3f}")
        debug_print(f"[OlmLGG] Image shape: {image.shape}, dtype: {image.dtype}, device: {image.device}")

        lift_params = {"hue": lift_hue, "sat": lift_sat, "strength": lift_strength, "luma": lift_luma}
        gamma_params = {"hue": gamma_hue, "sat": gamma_sat, "strength": gamma_strength, "luma": gamma_luma}
        gain_params = {"hue": gain_hue, "sat": gain_sat, "strength": gain_strength, "luma": gain_luma}

        debug_print(f"\n[OlmLGG] [RGB Conversions]")
        debug_print(f"[Lift RGB]: {hsl_to_lift_rgb(hue=lift_hue, sat=lift_sat, strength=lift_strength)}")
        debug_print(f"[Gamma RGB]: {hsl_to_gamma_rgb(hue=gamma_hue, sat=gamma_sat, strength=gamma_strength)}")
        debug_print(f"[Gain RGB]: {hsl_to_gain_rgb(hue=gain_hue, sat=gain_sat, strength=gain_strength)}")

        try:
            adjusted_image = apply_lift_gamma_gain(image, lift_params, gamma_params, gain_params)
            debug_print(f"[OlmLGG] [Success] Color adjustment applied successfully")
        except Exception as e:
            debug_print(f"[OlmLGG] [Error] Failed to apply color adjustment: {e}")
            adjusted_image = image

        current_lgg_values = {
            "lift": lift_params,
            "gamma": gamma_params,
            "gain": gain_params,
        }

        debug_print("=" * 60)

        return {
            "ui": {
                "lgg_values": [current_lgg_values]
            },
            "result": (adjusted_image,),
        }


NODE_CLASS_MAPPINGS = {
    "OlmLGG": OlmLGG,
}


NODE_DISPLAY_NAME_MAPPINGS = {
    "OlmLGG": "Olm Lift Gamma Gain (LGG)",
}


WEB_DIRECTORY = "./web"