import { useEffect, useRef } from 'react';

const AudioWaveform = ({ isActive, type = 'listening', className = '' }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      if (!isActive) {
        // Idle state - flat line with subtle pulse
        const centerY = height / 2;
        const time = Date.now() * 0.001;
        
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        
        for (let x = 0; x < width; x += 2) {
          const y = centerY + Math.sin(time + x * 0.01) * 2;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else {
        // Active waveform
        const time = Date.now() * 0.005;
        const bars = 40;
        const barWidth = width / bars;
        
        for (let i = 0; i < bars; i++) {
          let barHeight;
          
          if (type === 'listening') {
            // Listening animation - random heights with some pattern
            barHeight = (Math.sin(time + i * 0.5) * 0.5 + 0.5) * (height * 0.6) + 
                       (Math.random() * 0.3 + 0.1) * height * 0.4;
          } else if (type === 'speaking') {
            // Speaking animation - more rhythmic pattern
            barHeight = (Math.sin(time * 2 + i * 0.3) * 0.7 + 0.3) * height * 0.8;
          } else {
            // Processing animation - pulsing pattern
            barHeight = (Math.sin(time * 3 + i * 0.8) * 0.4 + 0.6) * height * 0.5;
          }
          
          const x = i * barWidth + barWidth / 2;
          const y = height - barHeight;
          
          // Gradient color based on type
          let color;
          if (type === 'listening') {
            color = `hsl(${120 + Math.sin(time + i) * 30}, 70%, 50%)`;
          } else if (type === 'speaking') {
            color = `hsl(${240 + Math.sin(time + i) * 20}, 70%, 60%)`;
          } else {
            color = `hsl(${45 + Math.sin(time + i) * 15}, 70%, 55%)`;
          }
          
          ctx.fillStyle = color;
          ctx.fillRect(x - barWidth * 0.3, y, barWidth * 0.6, barHeight);
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, type]);

  return (
    <canvas
      ref={canvasRef}
      width={300}
      height={60}
      className={`rounded-lg ${className}`}
    />
  );
};

export default AudioWaveform;