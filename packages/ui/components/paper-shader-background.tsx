"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const VERTEX_SHADER = `
	uniform float time;
	uniform float intensity;
	varying vec2 vUv;

	void main() {
		vUv = uv;

		vec3 pos = position;
		pos.y += sin(pos.x * 10.0 + time) * 0.1 * intensity;
		pos.x += cos(pos.y * 8.0 + time * 1.5) * 0.05 * intensity;

		gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
	}
`;

const FRAGMENT_SHADER = `
	uniform float time;
	uniform float intensity;
	uniform vec3 color1;
	uniform vec3 color2;
	varying vec2 vUv;

	void main() {
		vec2 uv = vUv;

		float noise = sin(uv.x * 20.0 + time) * cos(uv.y * 15.0 + time * 0.8);
		noise += sin(uv.x * 35.0 - time * 2.0) * cos(uv.y * 25.0 + time * 1.2) * 0.5;

		vec3 color = mix(color1, color2, noise * 0.5 + 0.5);
		color = mix(color, vec3(1.0), pow(abs(noise), 2.0) * intensity);

		float glow = 1.0 - length(uv - 0.5) * 2.0;
		glow = pow(glow, 2.0);

		gl_FragColor = vec4(color * glow, glow * 0.8);
	}
`;

interface PaperShaderBackgroundProps {
	color1?: string;
	color2?: string;
	ringRadius?: number;
	className?: string;
}

/**
 * Glowing animated shader plane with a pulsing energy ring, rendered via raw
 * Three.js (matches this repo's existing GLSLHills pattern — no React Three
 * Fiber). Fills its nearest positioned ancestor — the parent must give it
 * explicit dimensions.
 */
export function PaperShaderBackground({
	color1 = "#ff5722",
	color2 = "#ffffff",
	ringRadius = 1.4,
	className,
}: PaperShaderBackgroundProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const container = containerRef.current;
		const canvas = canvasRef.current;
		if (!container || !canvas) {
			return;
		}

		const uniforms = {
			time: { value: 0 },
			intensity: { value: 1.0 },
			color1: { value: new THREE.Color(color1) },
			color2: { value: new THREE.Color(color2) },
		};

		const shaderMesh = new THREE.Mesh(
			new THREE.PlaneGeometry(2, 2, 32, 32),
			new THREE.ShaderMaterial({
				uniforms,
				vertexShader: VERTEX_SHADER,
				fragmentShader: FRAGMENT_SHADER,
				transparent: true,
				side: THREE.DoubleSide,
			}),
		);

		const ringMaterial = new THREE.MeshBasicMaterial({
			color: "#ff5722",
			transparent: true,
			opacity: 0.6,
			side: THREE.DoubleSide,
		});
		const ringMesh = new THREE.Mesh(
			new THREE.RingGeometry(ringRadius * 0.8, ringRadius, 32),
			ringMaterial,
		);
		ringMesh.position.set(0, 0, 0.1);

		const group = new THREE.Group();
		group.scale.set(2, 2, 2);
		group.add(shaderMesh, ringMesh);

		const renderer = new THREE.WebGLRenderer({
			canvas,
			antialias: true,
			alpha: true,
		});
		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 10);
		camera.position.set(0, 0, 1.6);
		scene.add(group);

		const clock = new THREE.Clock();
		let animFrameId: number;

		const resize = () => {
			const w = container.clientWidth;
			const h = container.clientHeight;
			if (w === 0 || h === 0) {
				return;
			}
			camera.aspect = w / h;
			camera.updateProjectionMatrix();
			renderer.setSize(w, h, false);
		};

		resize();
		const resizeObserver = new ResizeObserver(resize);
		resizeObserver.observe(container);

		const loop = () => {
			const elapsed = clock.getElapsedTime();
			uniforms.time.value = elapsed;
			uniforms.intensity.value = 1.0 + Math.sin(elapsed * 2) * 0.3;
			ringMesh.rotation.z = elapsed;
			ringMaterial.opacity = 0.5 + Math.sin(elapsed * 3) * 0.3;
			renderer.render(scene, camera);
			animFrameId = requestAnimationFrame(loop);
		};
		loop();

		return () => {
			cancelAnimationFrame(animFrameId);
			resizeObserver.disconnect();
			renderer.dispose();
			shaderMesh.geometry.dispose();
			(shaderMesh.material as THREE.Material).dispose();
			ringMesh.geometry.dispose();
			ringMaterial.dispose();
		};
	}, [color1, color2, ringRadius]);

	return (
		<div
			ref={containerRef}
			className={`relative size-full overflow-hidden bg-black ${className ?? ""}`}
		>
			<canvas ref={canvasRef} className="absolute inset-0 size-full" />
		</div>
	);
}
