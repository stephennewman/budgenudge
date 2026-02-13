'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

// WebGL Fluid Simulation implementation
class FluidSimulation {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private programs: Map<string, WebGLProgram> = new Map();
  private framebuffers: WebGLFramebuffer[] = [];
  private textures: WebGLTexture[] = [];
  private vertexBuffer: WebGLBuffer | null = null;
  private config = {
    SIM_RESOLUTION: 128,
    DYE_RESOLUTION: 1024,
    CAPTURE_RESOLUTION: 512,
    DENSITY_DISSIPATION: 1,
    VELOCITY_DISSIPATION: 0.2,
    PRESSURE: 0.6,
    PRESSURE_ITERATIONS: 20,
    CURL: 30,
    SPLAT_RADIUS: 0.25,
    SPLAT_FORCE: 6000,
    SHADING: true,
    COLORFUL: true,
    COLOR_UPDATE_SPEED: 10,
    PAUSED: false,
    BACK_COLOR: { r: 0, g: 0, b: 0 },
    TRANSPARENT: false,
    BLOOM: true,
    BLOOM_ITERATIONS: 8,
    BLOOM_RESOLUTION: 256,
    BLOOM_INTENSITY: 0.8,
    BLOOM_THRESHOLD: 0.6,
    BLOOM_SOFT_KNEE: 0.7,
    SUNRAYS: true,
    SUNRAYS_RESOLUTION: 196,
    SUNRAYS_WEIGHT: 1.0,
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { alpha: true, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false });
    if (!gl) {
      console.error('WebGL2 not supported, falling back to simple animation');
      throw new Error('WebGL2 not supported');
    }
    this.gl = gl;
    
    this.resizeCanvas();
    this.init();
  }

  private resizeCanvas() {
    const displayWidth = this.canvas.clientWidth;
    const displayHeight = this.canvas.clientHeight;
    
    if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
      this.canvas.width = displayWidth;
      this.canvas.height = displayHeight;
    }
  }

  private init() {
    // Initialize shaders and framebuffers
    this.compileShaders();
    this.initFramebuffers();
    this.update();
  }

  private compileShaders() {

    // Base vertex shader
    const baseVertexShader = `#version 300 es
      in vec2 aPosition;
      out vec2 vUv;
      out vec2 vL;
      out vec2 vR;
      out vec2 vT;
      out vec2 vB;
      uniform vec2 texelSize;
      void main () {
          vUv = aPosition * 0.5 + 0.5;
          vL = vUv - vec2(texelSize.x, 0.0);
          vR = vUv + vec2(texelSize.x, 0.0);
          vT = vUv + vec2(0.0, texelSize.y);
          vB = vUv - vec2(0.0, texelSize.y);
          gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    // Color fragment shader with beautiful fluid colors
    const colorFragmentShader = `#version 300 es
      precision highp float;
      in vec2 vUv;
      out vec4 fragColor;
      uniform float time;
      
      vec3 hsv2rgb(vec3 c) {
          vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
          vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
          return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
      }
      
      void main () {
          vec2 p = vUv - 0.5;
          float len = length(p);
          
          // Create flowing colors based on position and time
          float hue = time * 0.1 + len * 2.0 + atan(p.y, p.x);
          float sat = 0.6 + 0.4 * sin(time * 0.8 + len * 5.0);
          float val = 0.7 + 0.3 * sin(time * 1.2 + len * 3.0);
          
          vec3 color = hsv2rgb(vec3(hue, sat, val));
          
          // Add flowing smoky effect with more contrast
          float noise1 = sin(time * 0.8 + p.x * 12.0 + p.y * 8.0) * 0.5 + 0.5;
          float noise2 = cos(time * 1.2 + p.y * 10.0 + p.x * 6.0) * 0.5 + 0.5;
          float smoke = noise1 * noise2;
          smoke *= exp(-len * 1.5); // Fade from center
          
          // Create more visible turbulent flow patterns
          vec2 flow = vec2(
              sin(time * 0.5 + p.x * 8.0 + p.y * 3.0),
              cos(time * 0.7 + p.y * 6.0 + p.x * 4.0)
          ) * 0.5;
          
          // Apply flow to the position for distortion
          vec2 distorted = p + flow * 0.1;
          float distortedLen = length(distorted);
          
          // More vibrant smoke colors
          vec3 smokeColor = vec3(0.9, 0.7, 1.0) * smoke * 2.0;
          color = mix(color, smokeColor, min(smoke * 0.8, 1.0));
          
          fragColor = vec4(color, 1.0);
      }
    `;

    // Simple splat shader for mouse interaction
    const splatFragmentShader = `#version 300 es
      precision highp float;
      in vec2 vUv;
      out vec4 fragColor;
      uniform sampler2D uTarget;
      uniform float aspectRatio;
      uniform vec3 color;
      uniform vec2 point;
      uniform float radius;
      
      void main () {
          vec2 p = vUv - point.xy;
          p.x *= aspectRatio;
          vec3 splat = exp(-dot(p, p) / radius) * color;
          vec3 base = texture(uTarget, vUv).xyz;
          fragColor = vec4(base + splat, 1.0);
      }
    `;

    // Create shader programs
    this.programs.set('color', this.createProgram(baseVertexShader, colorFragmentShader));
    this.programs.set('splat', this.createProgram(baseVertexShader, splatFragmentShader));
  }

  private createProgram(vertexSource: string, fragmentSource: string): WebGLProgram {
    const gl = this.gl;
    const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentSource);
    
    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Program link error: ' + gl.getProgramInfoLog(program));
    }
    
    return program;
  }

  private createShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error('Shader compile error: ' + gl.getShaderInfoLog(shader));
    }
    
    return shader;
  }

  private initFramebuffers() {
    // Create vertex buffer for full-screen quad
    const vertices = new Float32Array([
      -1, -1,
       1, -1,
       1,  1,
      -1,  1
    ]);
    
    this.vertexBuffer = this.gl.createBuffer()!;
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);
    
    // Create texture for fluid simulation
    const texture = this.gl.createTexture();
    if (texture) {
      this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
      this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA16F, this.canvas.width, this.canvas.height, 0, this.gl.RGBA, this.gl.HALF_FLOAT, null);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
      
      this.textures.push(texture);
    }
  }

  private update() {
    this.resizeCanvas();
    
    // Clear with darker background for better contrast
    const time = Date.now() * 0.001;
    
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.gl.clearColor(0.02, 0.02, 0.03, 1); // Very dark background
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    
    // Enable blending for smoke effects
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    
    // Create animated smoke effects
    const program = this.programs.get('color');
    if (program) {
      this.gl.useProgram(program);
      
      // Set time uniform for animation
      const timeLocation = this.gl.getUniformLocation(program, 'time');
      if (timeLocation) {
        this.gl.uniform1f(timeLocation, time);
      }
      
      // Bind vertex buffer and set up attributes
      if (this.vertexBuffer) {
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
        
        const aPosition = this.gl.getAttribLocation(program, 'aPosition');
        if (aPosition >= 0) {
          this.gl.enableVertexAttribArray(aPosition);
          this.gl.vertexAttribPointer(aPosition, 2, this.gl.FLOAT, false, 0, 0);
          
          // Draw fullscreen quad with smoke effect
          this.gl.drawArrays(this.gl.TRIANGLE_FAN, 0, 4);
          
          this.gl.disableVertexAttribArray(aPosition);
        }
      }
    }
    
    requestAnimationFrame(() => this.update());
  }

  public addSplat(x: number, y: number) {
    // Add splat effect at position
    const gl = this.gl;
    const program = this.programs.get('splat');
    if (program) {
      gl.useProgram(program);
      
      const pointLocation = gl.getUniformLocation(program, 'point');
      const colorLocation = gl.getUniformLocation(program, 'color');
      const radiusLocation = gl.getUniformLocation(program, 'radius');
      
      if (pointLocation) gl.uniform2f(pointLocation, x, y);
      if (colorLocation) gl.uniform3f(colorLocation, Math.random(), Math.random(), Math.random());
      if (radiusLocation) gl.uniform1f(radiusLocation, 0.1);
    }
  }
}

export default function FluidLanding() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simulationRef = useRef<FluidSimulation | null>(null);

  // Add CSS for fallback animation
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fluid-fallback {
        0% { 
          filter: hue-rotate(0deg) brightness(1); 
          transform: scale(1); 
        }
        50% { 
          filter: hue-rotate(90deg) brightness(1.2); 
          transform: scale(1.1); 
        }
        100% { 
          filter: hue-rotate(180deg) brightness(0.9); 
          transform: scale(1); 
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;

    try {
      simulationRef.current = new FluidSimulation(canvasRef.current);
    } catch (error) {
      console.error('Failed to initialize fluid simulation:', error);
      // Fallback: Create a simple CSS animation background
      if (canvasRef.current) {
        canvasRef.current.style.background = `
          radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3), transparent 50%),
          radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.3), transparent 50%),
          radial-gradient(circle at 40% 40%, rgba(120, 200, 255, 0.3), transparent 50%)
        `;
        canvasRef.current.style.animation = 'fluid-fallback 8s ease-in-out infinite alternate';
      }
    }

    // Add mouse interaction
    let lastInteractionTime = 0;
    const throttleDelay = 50;
    
    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      if (simulationRef.current && now - lastInteractionTime > throttleDelay) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          simulationRef.current.addSplat(x, y);
          lastInteractionTime = now;
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const now = Date.now();
      if (simulationRef.current && e.touches.length > 0 && now - lastInteractionTime > throttleDelay) {
        const touch = e.touches[0];
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const x = touch.clientX - rect.left;
          const y = touch.clientY - rect.top;
          simulationRef.current.addSplat(x, y);
          lastInteractionTime = now;
        }
      }
    };

    if (canvasRef.current) {
      canvasRef.current.addEventListener('mousemove', handleMouseMove);
      canvasRef.current.addEventListener('touchmove', handleTouchMove, { passive: false });
    }

         return () => {
       if (canvasRef.current) {
         canvasRef.current.removeEventListener('mousemove', handleMouseMove);
         canvasRef.current.removeEventListener('touchmove', handleTouchMove);
       }
     };
  }, []);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black">
      {/* WebGL Fluid Simulation Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ touchAction: 'none' }}
      />
      
      {/* Overlay Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-10 pointer-events-none">
        <div className="text-center px-4 max-w-4xl">
          {/* Tagline */}
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold mb-8 leading-tight">
            The coolest way to <br />
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              stop your money
            </span>
            <br />
            from going up in smoke
          </h1>
          
          {/* CTA Button */}
          <Button 
            asChild 
            size="lg" 
            className="pointer-events-auto bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 text-2xl px-12 py-6 h-auto font-bold rounded-full transition-all duration-300 hover:scale-105"
          >
            <Link href="/app">
              Enter
            </Link>
          </Button>
          
          {/* Subtle hint */}
          <p className="mt-6 text-sm text-white/60">
            Move your cursor to interact with the fluid
          </p>
        </div>
      </div>
      
      {/* Gradient overlay for better text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/50 pointer-events-none" />
    </div>
  );
} 