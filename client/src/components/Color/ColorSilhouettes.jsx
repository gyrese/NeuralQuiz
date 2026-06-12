import React from 'react';

/**
 * Helper to convert HSB to CSS HSL
 */
export function hsbToCss(h, s, b) {
    const v = b / 100;
    const sHsb = s / 100;
    const l = v * (1 - sHsb / 2);
    const sHsl = (l === 0 || l === 1) ? 0 : (v - l) / Math.min(l, 1 - l);
    
    return `hsl(${h}, ${Math.round(sHsl * 100)}%, ${Math.round(l * 100)}%)`;
}

/**
 * Returns a fallback vector SVG for the given character ID
 * styled with the user's current color guess or correct answer.
 */
export function renderSilhouette(id, color) {
    const strokeColor = '#0f172a';
    const strokeWidth = 3;

    switch (id) {
        case 'pikachu-skin':
            return (
                <svg viewBox="0 0 200 200" width="100%" height="100%" className="mx-auto">
                    {/* Background/Skin */}
                    <path d="M 60 50 C 40 10, 55 5, 68 30 C 80 40, 120 40, 132 30 C 145 5, 160 10, 140 50 C 165 80, 165 140, 140 160 C 120 172, 80 172, 60 160 C 35 140, 35 80, 60 50 Z" fill={color} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round" />
                    {/* Ear Tips */}
                    <path d="M 40 10 C 44 7, 49 6, 52 16 L 56 26 C 50 22, 45 18, 40 10 Z" fill="#000" />
                    <path d="M 160 10 C 156 7, 151 6, 148 16 L 144 26 C 150 22, 155 18, 160 10 Z" fill="#000" />
                    {/* Cheeks */}
                    <circle cx="56" cy="115" r="14" fill="#ef4444" stroke={strokeColor} strokeWidth={2} />
                    <circle cx="144" cy="115" r="14" fill="#ef4444" stroke={strokeColor} strokeWidth={2} />
                    {/* Eyes */}
                    <circle cx="75" cy="85" r="10" fill="#1e293b" />
                    <circle cx="72" cy="82" r="3.5" fill="#fff" />
                    <circle cx="125" cy="85" r="10" fill="#1e293b" />
                    <circle cx="122" cy="82" r="3.5" fill="#fff" />
                    {/* Nose */}
                    <polygon points="98,102 102,102 100,105" fill="#1e293b" />
                    {/* Mouth */}
                    <path d="M 92 112 C 96 115, 100 112, 100 112 C 100 112, 104 115, 108 112" fill="none" stroke={strokeColor} strokeWidth={2} strokeLinecap="round" />
                </svg>
            );

        case 'goku-hair':
            return (
                <svg viewBox="0 0 200 200" width="100%" height="100%" className="mx-auto">
                    {/* Skin */}
                    <path d="M 65 95 C 65 130, 135 130, 135 95 C 135 70, 65 70, 65 95 Z" fill="#fed7aa" stroke={strokeColor} strokeWidth={strokeWidth} />
                    {/* Eyes */}
                    <polygon points="76,95 90,95 86,102 78,101" fill="#fff" stroke={strokeColor} strokeWidth={1.5} />
                    <polygon points="124,95 110,95 114,102 122,101" fill="#fff" stroke={strokeColor} strokeWidth={1.5} />
                    <circle cx="83" cy="98" r="2.5" fill="#06b6d4" />
                    <circle cx="117" cy="98" r="2.5" fill="#06b6d4" />
                    {/* Eyebrows */}
                    <polygon points="72,90 92,93 90,90 74,88" fill={color} />
                    <polygon points="128,90 108,93 110,90 126,88" fill={color} />
                    {/* Super Saiyan Hair (Target Color) */}
                    <path d="M 65 95 C 50 90, 40 70, 50 60 C 40 50, 48 30, 65 35 C 60 15, 75 10, 85 25 C 90 5, 110 5, 115 25 C 125 10, 140 15, 135 35 C 152 30, 160 50, 150 60 C 160 70, 150 90, 135 95 L 125 78 C 120 85, 80 85, 75 78 Z" fill={color} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round" />
                    {/* Mouth */}
                    <path d="M 92 112 Q 100 118 108 112" fill="none" stroke={strokeColor} strokeWidth={2} strokeLinecap="round" />
                    {/* Gi collar */}
                    <path d="M 70 135 L 100 165 L 130 135 L 100 145 Z" fill="#ea580c" stroke={strokeColor} strokeWidth={strokeWidth} />
                </svg>
            );

        case 'homer-skin':
            return (
                <svg viewBox="0 0 200 200" width="100%" height="100%" className="mx-auto">
                    {/* Head Skin (Target Color) */}
                    <path d="M 60 70 C 60 25, 140 25, 140 70 L 140 110 C 140 110, 150 110, 150 120 C 150 130, 140 130, 140 135 L 140 150 C 140 155, 60 155, 60 150 L 60 70 Z" fill={color} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round" />
                    <path d="M 60 105 C 50 105, 50 120, 60 120" fill={color} stroke={strokeColor} strokeWidth={strokeWidth} />
                    {/* Muzzle/Beard */}
                    <path d="M 80 110 C 70 120, 70 150, 100 150 C 130 150, 135 130, 135 120 C 135 110, 120 110, 115 115 C 105 120, 95 120, 85 115 Z" fill="#d0a672" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round" />
                    {/* Eyes */}
                    <circle cx="95" cy="80" r="18" fill="#fff" stroke={strokeColor} strokeWidth={strokeWidth} />
                    <circle cx="125" cy="80" r="18" fill="#fff" stroke={strokeColor} strokeWidth={strokeWidth} />
                    <circle cx="98" cy="80" r="3.5" fill="#000" />
                    <circle cx="122" cy="80" r="3.5" fill="#000" />
                    {/* Nose */}
                    <path d="M 110 90 C 122 90, 122 102, 110 102" fill={color} stroke={strokeColor} strokeWidth={strokeWidth} />
                    {/* Collar (White) */}
                    <path d="M 60 154 L 50 180 L 90 180 L 100 162 L 110 180 L 150 180 L 140 154 Z" fill="#fff" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round" />
                    {/* Hair lines */}
                    <path d="M 85 32 C 85 24, 95 20, 100 28 M 105 30 C 110 20, 120 24, 120 32" fill="none" stroke={strokeColor} strokeWidth={2} />
                    <path d="M 58 90 C 50 90, 48 95, 58 98 M 58 96 C 50 98, 48 102, 58 104" fill="none" stroke={strokeColor} strokeWidth={2} />
                </svg>
            );

        case 'shrek-skin':
            return (
                <svg viewBox="0 0 200 200" width="100%" height="100%" className="mx-auto">
                    {/* Ears / Trumpets */}
                    <path d="M 50 75 C 25 70, 25 55, 45 65 Z" fill={color} stroke={strokeColor} strokeWidth={strokeWidth} />
                    <path d="M 150 75 C 175 70, 175 55, 155 65 Z" fill={color} stroke={strokeColor} strokeWidth={strokeWidth} />
                    {/* Face */}
                    <path d="M 50 90 C 50 45, 150 45, 150 90 C 150 145, 50 145, 50 90 Z" fill={color} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round" />
                    {/* Nose */}
                    <path d="M 90 95 C 80 105, 120 105, 110 95 C 105 92, 95 92, 90 95 Z" fill={color} stroke={strokeColor} strokeWidth={2.5} />
                    {/* Eyes */}
                    <ellipse cx="80" cy="80" rx="12" ry="8" fill="#fff" stroke={strokeColor} strokeWidth={2.5} />
                    <ellipse cx="120" cy="80" rx="12" ry="8" fill="#fff" stroke={strokeColor} strokeWidth={2.5} />
                    <circle cx="80" cy="80" r="4.5" fill="#78350f" />
                    <circle cx="120" cy="80" r="4.5" fill="#78350f" />
                    {/* Smile */}
                    <path d="M 68 112 Q 100 135 132 112" fill="none" stroke={strokeColor} strokeWidth={3} strokeLinecap="round" />
                    {/* Shirt */}
                    <path d="M 60 142 L 50 185 L 150 185 L 140 142 Z" fill="#e5d5c0" stroke={strokeColor} strokeWidth={strokeWidth} />
                    {/* Brown Vest */}
                    <path d="M 50 185 L 75 142 L 90 142 L 85 185 Z" fill="#452a12" stroke={strokeColor} strokeWidth={2.5} />
                    <path d="M 150 185 L 125 142 L 110 142 L 115 185 Z" fill="#452a12" stroke={strokeColor} strokeWidth={2.5} />
                </svg>
            );

        case 'spongebob-body':
            return (
                <svg viewBox="0 0 200 200" width="100%" height="100%" className="mx-auto">
                    {/* Sponge Body (Target Color) */}
                    <path d="M 40 30 C 50 25, 150 25, 160 30 C 165 60, 165 110, 160 135 C 150 140, 50 140, 40 135 C 35 110, 35 60, 40 30 Z" fill={color} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round" />
                    {/* Eyes */}
                    <circle cx="75" cy="70" r="20" fill="#fff" stroke={strokeColor} strokeWidth={strokeWidth} />
                    <circle cx="125" cy="70" r="20" fill="#fff" stroke={strokeColor} strokeWidth={strokeWidth} />
                    <circle cx="75" cy="70" r="8" fill="#00b4d8" stroke={strokeColor} strokeWidth={2} />
                    <circle cx="125" cy="70" r="8" fill="#00b4d8" stroke={strokeColor} strokeWidth={2} />
                    <circle cx="75" cy="70" r="4" fill="#000" />
                    <circle cx="125" cy="70" r="4" fill="#000" />
                    {/* Nose */}
                    <path d="M 100 70 C 112 70, 112 85, 100 85" fill={color} stroke={strokeColor} strokeWidth={strokeWidth} />
                    {/* Smile */}
                    <path d="M 62 98 Q 100 125 138 98" fill="none" stroke={strokeColor} strokeWidth={3.5} strokeLinecap="round" />
                    <path d="M 88 103 L 94 112 L 106 112 L 112 103" fill="#fff" stroke={strokeColor} strokeWidth={2} strokeLinejoin="round" />
                    {/* Clothes */}
                    <path d="M 42 135 L 158 135 L 158 145 L 42 145 Z" fill="#fff" stroke={strokeColor} strokeWidth={strokeWidth} />
                    <path d="M 42 145 L 158 145 L 158 165 L 42 165 Z" fill="#78350f" stroke={strokeColor} strokeWidth={strokeWidth} />
                    {/* Red Tie */}
                    <polygon points="95,135 105,135 108,155 100,162 92,155" fill="#ef4444" stroke={strokeColor} strokeWidth={2} />
                </svg>
            );

        case 'doraemon-body':
            return (
                <svg viewBox="0 0 200 200" width="100%" height="100%" className="mx-auto">
                    {/* Blue body (Target Color) */}
                    <circle cx="100" cy="95" r="65" fill={color} stroke={strokeColor} strokeWidth={strokeWidth} />
                    {/* White Face */}
                    <circle cx="100" cy="103" r="50" fill="#fff" stroke={strokeColor} strokeWidth={2.5} />
                    {/* Eyes */}
                    <ellipse cx="86" cy="68" rx="14" ry="18" fill="#fff" stroke={strokeColor} strokeWidth={2.5} />
                    <ellipse cx="114" cy="68" rx="14" ry="18" fill="#fff" stroke={strokeColor} strokeWidth={2.5} />
                    <circle cx="92" cy="68" r="3" fill="#000" />
                    <circle cx="108" cy="68" r="3" fill="#000" />
                    {/* Nose */}
                    <circle cx="100" cy="86" r="10" fill="#ef4444" stroke={strokeColor} strokeWidth={2} />
                    <circle cx="97" cy="83" r="3" fill="#fff" />
                    {/* Whiskers & Mouth */}
                    <path d="M 100 96 L 100 135" stroke={strokeColor} strokeWidth={2.5} />
                    <path d="M 68 112 Q 100 148 132 112" fill="none" stroke={strokeColor} strokeWidth={3} strokeLinecap="round" />
                    <path d="M 60 90 L 85 93 M 58 102 L 85 102 M 60 114 L 85 111" stroke={strokeColor} strokeWidth={2} />
                    <path d="M 140 90 L 115 93 M 142 102 L 115 102 M 140 114 L 115 111" stroke={strokeColor} strokeWidth={2} />
                    {/* Collar & Bell */}
                    <path d="M 65 145 Q 100 155 135 145" fill="none" stroke="#dc2626" strokeWidth={8} strokeLinecap="round" />
                    <circle cx="100" cy="154" r="12" fill="#facc15" stroke={strokeColor} strokeWidth={2.5} />
                    <circle cx="100" cy="151" r="2.5" fill="#1e293b" />
                </svg>
            );

        case 'smurf-skin':
            return (
                <svg viewBox="0 0 200 200" width="100%" height="100%" className="mx-auto">
                    {/* Skin (Target Color) */}
                    <path d="M 55 90 C 55 50, 145 50, 145 90 C 145 130, 55 130, 55 90 Z" fill={color} stroke={strokeColor} strokeWidth={strokeWidth} />
                    <path d="M 55 100 C 45 100, 45 115, 55 115" fill={color} stroke={strokeColor} strokeWidth={strokeWidth} />
                    <path d="M 145 100 C 155 100, 155 115, 145 115" fill={color} stroke={strokeColor} strokeWidth={strokeWidth} />
                    {/* Nose */}
                    <ellipse cx="100" cy="95" rx="14" ry="10" fill={color} stroke={strokeColor} strokeWidth={2.5} />
                    {/* Eyes */}
                    <ellipse cx="88" cy="78" rx="10" ry="14" fill="#fff" stroke={strokeColor} strokeWidth={2} />
                    <ellipse cx="112" cy="78" rx="10" ry="14" fill="#fff" stroke={strokeColor} strokeWidth={2} />
                    <circle cx="91" cy="78" r="3" fill="#000" />
                    <circle cx="109" cy="78" r="3" fill="#000" />
                    {/* Smile */}
                    <path d="M 82 114 Q 100 128 118 114" fill="none" stroke={strokeColor} strokeWidth={2.5} strokeLinecap="round" />
                    {/* White Cap */}
                    <path d="M 56 78 C 50 78, 60 20, 100 20 C 140 20, 150 78, 144 78 C 130 78, 130 50, 100 45 C 70 50, 70 78, 56 78 Z" fill="#fff" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round" />
                    {/* Body */}
                    <path d="M 70 128 L 60 185 L 140 185 L 130 128 Z" fill="#fff" stroke={strokeColor} strokeWidth={strokeWidth} />
                </svg>
            );

        case 'mickey-shorts':
            return (
                <svg viewBox="0 0 200 200" width="100%" height="100%" className="mx-auto">
                    {/* Ears */}
                    <circle cx="55" cy="45" r="30" fill="#000" />
                    <circle cx="145" cy="45" r="30" fill="#000" />
                    {/* Head */}
                    <circle cx="100" cy="95" r="45" fill="#000" />
                    {/* Face Mask (Beige) */}
                    <path d="M 72 90 C 65 105, 80 128, 100 128 C 120 128, 135 105, 128 90 C 130 80, 115 72, 100 80 C 85 72, 70 80, 72 90 Z" fill="#ffedd5" />
                    {/* Eyes */}
                    <ellipse cx="92" cy="85" rx="5" ry="12" fill="#fff" stroke={strokeColor} strokeWidth={1} />
                    <ellipse cx="108" cy="85" rx="5" ry="12" fill="#fff" stroke={strokeColor} strokeWidth={1} />
                    <ellipse cx="92" cy="89" rx="2" ry="5" fill="#000" />
                    <ellipse cx="108" cy="89" rx="2" ry="5" fill="#000" />
                    {/* Nose */}
                    <ellipse cx="100" cy="102" rx="8" ry="4" fill="#000" />
                    {/* Mouth */}
                    <path d="M 85 110 Q 100 124 115 110" fill="none" stroke={strokeColor} strokeWidth={2} strokeLinecap="round" />
                    {/* Shorts (Target Color) */}
                    <path d="M 65 142 C 65 125, 135 125, 135 142 L 135 185 C 135 185, 105 185, 100 178 C 95 185, 65 185, 65 185 Z" fill={color} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round" />
                    {/* Buttons */}
                    <ellipse cx="85" cy="154" rx="6" ry="10" fill="#fff" stroke={strokeColor} strokeWidth={1.5} />
                    <ellipse cx="115" cy="154" rx="6" ry="10" fill="#fff" stroke={strokeColor} strokeWidth={1.5} />
                </svg>
            );

        case 'minion-body':
            return (
                <svg viewBox="0 0 200 200" width="100%" height="100%" className="mx-auto">
                    {/* Capsule Body (Target Color) */}
                    <path d="M 60 80 C 60 30, 140 30, 140 80 L 140 140 C 140 150, 60 150, 60 140 Z" fill={color} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round" />
                    {/* Overalls (Blue Denim) */}
                    <path d="M 60 130 L 140 130 L 140 175 C 140 180, 60 180, 60 175 Z" fill="#1d4ed8" stroke={strokeColor} strokeWidth={strokeWidth} />
                    <path d="M 78 110 L 122 110 L 122 130 L 78 130 Z" fill="#1d4ed8" stroke={strokeColor} strokeWidth={strokeWidth} />
                    {/* Straps */}
                    <path d="M 60 110 L 78 115 L 78 123 L 60 118 Z" fill="#1d4ed8" stroke={strokeColor} strokeWidth={1.5} />
                    <path d="M 140 110 L 122 115 L 122 123 L 140 118 Z" fill="#1d4ed8" stroke={strokeColor} strokeWidth={1.5} />
                    {/* Goggles & Eyes */}
                    <path d="M 58 75 L 142 75" stroke="#000" strokeWidth={12} />
                    <circle cx="82" cy="75" r="20" fill="#94a3b8" stroke={strokeColor} strokeWidth={2} />
                    <circle cx="118" cy="75" r="20" fill="#94a3b8" stroke={strokeColor} strokeWidth={2} />
                    <circle cx="82" cy="75" r="14" fill="#fff" />
                    <circle cx="118" cy="75" r="14" fill="#fff" />
                    <circle cx="82" cy="75" r="5.5" fill="#78350f" />
                    <circle cx="118" cy="75" r="5.5" fill="#78350f" />
                    <circle cx="82" cy="75" r="2.5" fill="#000" />
                    <circle cx="118" cy="75" r="2.5" fill="#000" />
                    {/* Smile */}
                    <path d="M 88 100 Q 100 110 112 100" fill="none" stroke={strokeColor} strokeWidth={2.5} strokeLinecap="round" />
                </svg>
            );

        case 'patrick-body':
            return (
                <svg viewBox="0 0 200 200" width="100%" height="100%" className="mx-auto">
                    {/* Body (Target Color) */}
                    <path d="M 100 25 C 105 25, 120 70, 125 90 C 145 95, 175 100, 175 110 C 175 120, 145 130, 135 140 C 135 160, 138 180, 130 185 C 120 185, 105 178, 100 178 C 95 178, 80 185, 70 185 C 62 180, 65 160, 65 140 C 55 130, 25 120, 25 110 C 25 100, 55 95, 75 90 C 80 70, 95 25, 100 25 Z" fill={color} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round" />
                    {/* Eyes */}
                    <ellipse cx="94" cy="70" rx="6" ry="10" fill="#fff" stroke={strokeColor} strokeWidth={1.5} />
                    <ellipse cx="106" cy="70" rx="6" ry="10" fill="#fff" stroke={strokeColor} strokeWidth={1.5} />
                    <circle cx="95" cy="72" r="2" fill="#000" />
                    <circle cx="105" cy="72" r="2" fill="#000" />
                    {/* Mouth */}
                    <path d="M 85 92 Q 100 115 115 92" fill="none" stroke={strokeColor} strokeWidth={2.5} strokeLinecap="round" />
                    {/* Pants (Green with purple flowers) */}
                    <path d="M 70 142 C 70 142, 100 135, 130 142 L 132 170 C 132 170, 118 165, 100 170 C 82 165, 68 170, 68 170 Z" fill="#84cc16" stroke={strokeColor} strokeWidth={2.5} strokeLinejoin="round" />
                </svg>
            );

        case 'pinkpanther-skin':
            return (
                <svg viewBox="0 0 200 200" width="100%" height="100%" className="mx-auto">
                    {/* Face Skin (Target Color) */}
                    <path d="M 50 115 C 50 65, 150 65, 150 115 C 150 155, 120 155, 100 150 C 80 155, 50 155, 50 115 Z" fill={color} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round" />
                    {/* Ears */}
                    <circle cx="58" cy="75" r="18" fill={color} stroke={strokeColor} strokeWidth={strokeWidth} />
                    <circle cx="142" cy="75" r="18" fill={color} stroke={strokeColor} strokeWidth={strokeWidth} />
                    <circle cx="58" cy="75" r="10" fill="#fca5a5" />
                    <circle cx="142" cy="75" r="10" fill="#fca5a5" />
                    {/* Muzzle (White/Light) */}
                    <ellipse cx="85" cy="122" rx="18" ry="12" fill="#fffef0" stroke={strokeColor} strokeWidth={2} />
                    <ellipse cx="115" cy="122" rx="18" ry="12" fill="#fffef0" stroke={strokeColor} strokeWidth={2} />
                    {/* Nose (Red) */}
                    <polygon points="94,110 106,110 100,118" fill="#f43f5e" stroke={strokeColor} strokeWidth={1.5} />
                    {/* Eyes (Yellow with black pupils) */}
                    <ellipse cx="85" cy="90" rx="12" ry="10" fill="#facc15" stroke={strokeColor} strokeWidth={2} />
                    <ellipse cx="115" cy="90" rx="12" ry="10" fill="#facc15" stroke={strokeColor} strokeWidth={2} />
                    <circle cx="85" cy="90" r="3" fill="#000" />
                    <circle cx="115" cy="90" r="3" fill="#000" />
                </svg>
            );

        case 'scoobydoo-fur':
            return (
                <svg viewBox="0 0 200 200" width="100%" height="100%" className="mx-auto">
                    {/* Head Fur (Target Color) */}
                    <path d="M 60 70 C 60 40, 140 40, 140 70 L 140 145 C 140 145, 110 155, 100 150 C 90 155, 60 155, 60 145 Z" fill={color} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round" />
                    {/* Ears */}
                    <path d="M 65 45 L 50 15 C 60 15, 75 35, 75 45 Z" fill={color} stroke={strokeColor} strokeWidth={strokeWidth} />
                    <path d="M 135 45 L 150 15 C 140 15, 125 35, 125 45 Z" fill={color} stroke={strokeColor} strokeWidth={strokeWidth} />
                    {/* Nose (Black) */}
                    <path d="M 90 110 C 90 98, 110 98, 110 110 Z" fill="#000" />
                    {/* Eyes */}
                    <circle cx="86" cy="78" r="7" fill="#fff" stroke={strokeColor} strokeWidth={1.5} />
                    <circle cx="114" cy="78" r="7" fill="#fff" stroke={strokeColor} strokeWidth={1.5} />
                    <circle cx="86" cy="78" r="2" fill="#000" />
                    <circle cx="114" cy="78" r="2" fill="#000" />
                    {/* Collar (Teal) */}
                    <path d="M 60 142 Q 100 155 140 142 L 138 152 Q 100 165 62 152 Z" fill="#06b6d4" stroke={strokeColor} strokeWidth={2} />
                    <polygon points="100,152 108,160 100,168 92,160" fill="#fbbf24" stroke={strokeColor} strokeWidth={1.5} />
                </svg>
            );

        case 'donald-jacket':
            return (
                <svg viewBox="0 0 200 200" width="100%" height="100%" className="mx-auto">
                    {/* Duck Head */}
                    <circle cx="100" cy="80" r="35" fill="#fff" stroke={strokeColor} strokeWidth={strokeWidth} />
                    {/* Beak */}
                    <path d="M 72 88 C 60 98, 140 98, 128 88 Z" fill="#fbbf24" stroke={strokeColor} strokeWidth={2.5} />
                    {/* Eyes */}
                    <ellipse cx="90" cy="70" rx="6" ry="14" fill="#fff" stroke={strokeColor} strokeWidth={2} />
                    <ellipse cx="110" cy="70" rx="6" ry="14" fill="#fff" stroke={strokeColor} strokeWidth={2} />
                    <ellipse cx="90" cy="74" rx="2" ry="5" fill="#06b6d4" />
                    <ellipse cx="110" cy="74" rx="2" ry="5" fill="#06b6d4" />
                    {/* Cap (Blue) */}
                    <path d="M 82 50 C 82 50, 100 38, 118 50 Z" fill="#1d4ed8" stroke={strokeColor} strokeWidth={2} />
                    <path d="M 76 56 Q 100 48 124 56" fill="none" stroke={strokeColor} strokeWidth={4} />
                    {/* Sailor Jacket (Target Color) */}
                    <path d="M 60 125 L 50 185 L 150 185 L 140 125 Z" fill={color} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round" />
                    {/* Red Bow */}
                    <circle cx="100" cy="130" r="6" fill="#ef4444" stroke={strokeColor} strokeWidth={1.5} />
                    <polygon points="100,130 85,122 88,138" fill="#ef4444" stroke={strokeColor} strokeWidth={1.5} />
                    <polygon points="100,130 115,122 112,138" fill="#ef4444" stroke={strokeColor} strokeWidth={1.5} />
                </svg>
            );

        case 'garfield-fur':
            return (
                <svg viewBox="0 0 200 200" width="100%" height="100%" className="mx-auto">
                    {/* Fur (Target Color) */}
                    <path d="M 50 95 C 50 45, 150 45, 150 95 C 150 145, 50 145, 50 95 Z" fill={color} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round" />
                    {/* Ears */}
                    <polygon points="55,60 40,25 75,45" fill={color} stroke={strokeColor} strokeWidth={strokeWidth} />
                    <polygon points="145,60 160,25 125,45" fill={color} stroke={strokeColor} strokeWidth={strokeWidth} />
                    {/* Eyes (Huge half ovals) */}
                    <path d="M 68 75 C 68 50, 100 50, 100 75 Z" fill="#fff" stroke={strokeColor} strokeWidth={2} />
                    <path d="M 100 75 C 100 50, 132 50, 132 75 Z" fill="#fff" stroke={strokeColor} strokeWidth={2} />
                    <ellipse cx="92" cy="70" rx="3.5" ry="6" fill="#000" />
                    <ellipse cx="108" cy="70" rx="3.5" ry="6" fill="#000" />
                    {/* Nose (Pink) */}
                    <ellipse cx="100" cy="85" rx="6" ry="4" fill="#f472b6" stroke={strokeColor} strokeWidth={1.5} />
                    {/* Cheeks & Whiskers lines */}
                    <path d="M 80 92 Q 100 105 120 92" fill="none" stroke={strokeColor} strokeWidth={2} strokeLinecap="round" />
                    {/* Black stripes */}
                    <polygon points="50,90 65,92 50,96" fill="#000" />
                    <polygon points="150,90 135,92 150,96" fill="#000" />
                </svg>
            );

        case 'perry-fur':
            return (
                <svg viewBox="0 0 200 200" width="100%" height="100%" className="mx-auto">
                    {/* Body/Fur (Target Color) */}
                    <path d="M 65 60 L 135 60 L 135 185 L 65 185 Z" fill={color} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round" />
                    {/* Bill/Beak (Orange) */}
                    <path d="M 50 90 L 95 90 C 105 90, 105 108, 95 108 L 65 108 C 55 108, 50 100, 50 90 Z" fill="#f97316" stroke={strokeColor} strokeWidth={2.5} strokeLinejoin="round" />
                    {/* Eyes */}
                    <circle cx="82" cy="78" r="9" fill="#fff" stroke={strokeColor} strokeWidth={2} />
                    <circle cx="118" cy="78" r="9" fill="#fff" stroke={strokeColor} strokeWidth={2} />
                    <circle cx="80" cy="78" r="2.5" fill="#000" />
                    <circle cx="120" cy="78" r="2.5" fill="#000" />
                    {/* Fedora Hat (Brown) */}
                    <ellipse cx="100" cy="54" rx="38" ry="6" fill="#065f46" stroke={strokeColor} strokeWidth={2} />
                    <path d="M 75 52 L 80 25 L 120 25 L 125 52 Z" fill="#065f46" stroke={strokeColor} strokeWidth={strokeWidth} />
                    <path d="M 78 44 L 122 44 L 123 48 L 77 48 Z" fill="#000" />
                </svg>
            );

        default:
            // Generic fallback silhouette shape
            return (
                <div className="silhouette-fallback">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 16v-4M12 8h.01"/>
                    </svg>
                    <div style={{ color }}>{color}</div>
                </div>
            );
    }
}
