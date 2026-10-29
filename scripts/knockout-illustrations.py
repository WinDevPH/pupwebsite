from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation, generate_binary_structure, label

ROOT = Path(__file__).resolve().parents[1]
FILES = [
    *sorted((ROOT / 'src/assets/how-it-works').glob('*.jpg')),
    ROOT / 'src/assets/calendar/empty.jpg',
    ROOT / 'src/assets/announcements/empty-character.jpg',
]


def corner_patches(rgb: np.ndarray, size: int = 18) -> np.ndarray:
    h, w = rgb.shape[:2]
    s = min(size, h // 6, w // 6)
    return np.concatenate(
        [
            rgb[:s, :s].reshape(-1, 3),
            rgb[:s, -s:].reshape(-1, 3),
            rgb[-s:, :s].reshape(-1, 3),
            rgb[-s:, -s:].reshape(-1, 3),
        ]
    )


def knockout(src: Path) -> None:
    im = Image.open(src).convert('RGBA')
    arr = np.array(im, dtype=np.float32)
    rgb = arr[..., :3]
    h, w = rgb.shape[:2]
    corners = corner_patches(rgb)
    key = np.median(corners, axis=0)
    dist = np.sqrt(((rgb - key) ** 2).sum(axis=2))
    corner_dist = np.sqrt(((corners - key) ** 2).sum(axis=1))
    key_luma = float(key.mean())
    if key_luma >= 248:
        thresh = 18.0
    else:
        thresh = min(float(np.percentile(corner_dist, 98) + 14), 36.0)
    paper = dist <= thresh
    labeled, _ = label(paper, generate_binary_structure(2, 2))
    s = min(18, h // 6, w // 6)
    seeds = np.unique(
        np.concatenate(
            [
                labeled[:s, :s].ravel(),
                labeled[:s, -s:].ravel(),
                labeled[-s:, :s].ravel(),
                labeled[-s:, -s:].ravel(),
            ]
        )
    )
    seeds = seeds[seeds != 0]
    bg = np.isin(labeled, seeds)
    bg = binary_dilation(bg, iterations=1) & (dist <= thresh + 10)
    alpha = np.full((h, w), 255.0, dtype=np.float32)
    alpha[bg] = 0
    if key_luma < 248:
        alpha[dist <= 12] = 0
    ring = binary_dilation(alpha == 0, iterations=2) & (alpha > 0)
    fade = np.clip((dist - thresh * 0.4) / max(thresh * 0.85, 8), 0, 1)
    alpha[ring] = np.minimum(alpha[ring], fade[ring] * 255)
    arr[..., 3] = alpha
    dest = src.with_suffix('.png')
    Image.fromarray(arr.astype(np.uint8)).save(dest, optimize=True)
    opaque = (alpha > 12).mean() * 100
    key_t = tuple(int(v) for v in key.round())
    print(f'{src.name:28} key={key_t} thresh={thresh:5.1f} opaque={opaque:5.1f}% -> {dest.name}')


if __name__ == '__main__':
    for path in FILES:
        knockout(path)
