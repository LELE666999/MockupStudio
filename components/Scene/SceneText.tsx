import React, { useRef } from 'react';
import { Text } from '@react-three/drei';
import { TextConfig } from '../../types';
import * as THREE from 'three';

interface Props {
  config: TextConfig;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDoubleClick: (id: string) => void;
}

export const SceneText: React.FC<Props> = ({ config, isSelected, onSelect, onDoubleClick }) => {
  const { id, content, font, fontSize, position, rotation, scale, color, opacity, blur, glow, visible } = config;
  const meshRef = useRef<THREE.Mesh>(null);

  // Robust visibility check
  const isVisible = visible !== false;

  const hasGlow = glow > 0;
  const hasBlur = blur > 0;

  // Gaussian Blur Simulation Logic
  const outlineColor = color;

  const outlineWidth = hasBlur
      ? 0.05 + (blur * 0.1)
      : (hasGlow ? glow * 0.05 : 0);

  const outlineBlur = hasBlur
      ? blur * 0.5
      : (hasGlow ? glow * 0.2 : 0);

  const effectiveFillOpacity = hasBlur
      ? Math.max(0, opacity * (1 - Math.min(1, blur * 1.5)))
      : opacity;

  return (
    <group
        visible={isVisible}
        position={position}
        rotation={rotation}
        scale={scale}
        onClick={(e) => {
            e.stopPropagation();
            onSelect(id);
        }}
        onDoubleClick={(e) => {
            e.stopPropagation();
            onDoubleClick(id);
        }}
    >
        <Text
            ref={meshRef}
            font={font || undefined}
            fontSize={fontSize}
            color={color}
            anchorX="center"
            anchorY="middle"
            outlineWidth={outlineWidth}
            outlineBlur={outlineBlur}
            outlineColor={outlineColor}
            fillOpacity={effectiveFillOpacity}
            strokeOpacity={opacity}
            // CRITICAL: Disable tone mapping to ensure pure colors (White stays White)
            // This prevents the text from looking gray in high dynamic range scenes
            material-toneMapped={false}
            // Ensure render order is correct for transparency
            renderOrder={999}
        >
            {content}
        </Text>

        {isSelected && (
            <mesh position={[0, 0, -0.01]}>
                <planeGeometry args={[content.length * fontSize * 0.6 + 0.5, fontSize * 1.5 + 0.5]} />
                <meshBasicMaterial color="#3b82f6" transparent opacity={0.15} side={THREE.DoubleSide} toneMapped={false} />
            </mesh>
        )}
    </group>
  );
};
