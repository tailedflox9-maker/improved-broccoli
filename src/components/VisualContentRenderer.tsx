import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import rough from 'roughjs';
import { VisualContent } from '../types';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';

interface VisualContentRendererProps {
  visualContent: VisualContent;
  className?: string;
}

export function VisualContentRenderer({ visualContent, className = '' }: VisualContentRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const renderContent = async () => {
      setIsLoading(true);
      setError(null);

      try {
        if (visualContent.type === 'mermaid') {
          await renderMermaidDiagram();
        } else if (visualContent.type === 'rough') {
          await renderRoughDiagram();
        }
      } catch (err) {
        console.error('Error rendering visual content:', err);
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
      } finally {
        setIsLoading(false);
      }
    };

    if (isVisible) {
      renderContent();
    }
  }, [visualContent, isVisible]);

  const renderMermaidDiagram = async () => {
    if (!containerRef.current) return;

    // Initialize mermaid
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      themeVariables: {
        primaryColor: '#3b82f6',
        primaryTextColor: '#e5e7eb',
        primaryBorderColor: '#374151',
        lineColor: '#6b7280',
        secondaryColor: '#1f2937',
        tertiaryColor: '#111827',
        background: '#0f172a',
        mainBkg: '#1e293b',
        secondBkg: '#334155',
        tertiaryBkg: '#475569'
      },
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      fontSize: 14,
    });

    try {
      const { svg } = await mermaid.render(`mermaid-${Date.now()}`, visualContent.code);
      containerRef.current.innerHTML = svg;
      
      // Style the SVG
      const svgElement = containerRef.current.querySelector('svg');
      if (svgElement) {
        svgElement.style.maxWidth = '100%';
        svgElement.style.height = 'auto';
        svgElement.style.backgroundColor = 'var(--color-card)';
        svgElement.style.borderRadius = '8px';
        svgElement.style.padding = '16px';
      }
    } catch (err) {
      throw new Error(`Mermaid rendering failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const renderRoughDiagram = async () => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    // Set canvas size
    const container = containerRef.current;
    const containerWidth = container.clientWidth || 400;
    canvas.width = containerWidth;
    canvas.height = 300;

    // Clear canvas
    ctx.fillStyle = 'var(--color-card)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const rc = rough.canvas(canvas);

    try {
      // Parse the rough diagram code (simplified JSON format)
      const diagramData = JSON.parse(visualContent.code);
      
      // Set drawing options for hand-drawn style
      const options = {
        roughness: 1.5,
        bowing: 2,
        stroke: '#e5e7eb',
        strokeWidth: 2,
        fill: '#3b82f6',
        fillStyle: 'hachure'
      };

      // Render based on diagram data
      if (diagramData.type === 'flowchart') {
        renderRoughFlowchart(rc, diagramData, options);
      } else if (diagramData.type === 'concept-map') {
        renderRoughConceptMap(rc, diagramData, options);
      } else {
        renderSimpleRoughDiagram(rc, diagramData, options);
      }

    } catch (err) {
      throw new Error(`Rough diagram parsing failed: ${err instanceof Error ? err.message : 'Invalid diagram format'}`);
    }
  };

  const renderRoughFlowchart = (rc: any, data: any, options: any) => {
    // Simple flowchart rendering
    const nodes = data.nodes || [];
    const connections = data.connections || [];

    // Draw nodes
    nodes.forEach((node: any, index: number) => {
      const x = 50 + (index % 3) * 120;
      const y = 50 + Math.floor(index / 3) * 80;
      
      rc.rectangle(x, y, 100, 50, { ...options, fill: index === 0 ? '#10b981' : options.fill });
      
      // Add text (rough approximation)
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#e5e7eb';
          ctx.font = '12px ui-sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(node.label || `Step ${index + 1}`, x + 50, y + 30);
        }
      }
    });

    // Draw simple connections
    connections.forEach((conn: any) => {
      const fromIndex = conn.from || 0;
      const toIndex = conn.to || 1;
      const fromX = 100 + (fromIndex % 3) * 120;
      const fromY = 75 + Math.floor(fromIndex / 3) * 80;
      const toX = 100 + (toIndex % 3) * 120;
      const toY = 75 + Math.floor(toIndex / 3) * 80;
      
      rc.line(fromX, fromY, toX, toY, options);
    });
  };

  const renderRoughConceptMap = (rc: any, data: any, options: any) => {
    // Simple concept map with central node and connections
    const concepts = data.concepts || [];
    const centerX = 200;
    const centerY = 150;
    
    // Draw central concept
    rc.ellipse(centerX, centerY, 80, 40, { ...options, fill: '#ef4444' });
    
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#e5e7eb';
        ctx.font = '14px ui-sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(data.title || 'Main Concept', centerX, centerY);
      }
    }

    // Draw surrounding concepts
    concepts.forEach((concept: any, index: number) => {
      const angle = (index / concepts.length) * 2 * Math.PI;
      const x = centerX + Math.cos(angle) * 120;
      const y = centerY + Math.sin(angle) * 80;
      
      rc.ellipse(x, y, 60, 30, options);
      rc.line(centerX, centerY, x, y, { ...options, strokeWidth: 1 });
      
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#e5e7eb';
          ctx.font = '10px ui-sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(concept.label || `Concept ${index + 1}`, x, y);
        }
      }
    });
  };

  const renderSimpleRoughDiagram = (rc: any, data: any, options: any) => {
    // Fallback: simple shapes demonstration
    rc.rectangle(50, 50, 100, 60, options);
    rc.ellipse(250, 80, 80, 50, { ...options, fill: '#8b5cf6' });
    rc.line(150, 80, 210, 80, options);
    
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#e5e7eb';
        ctx.font = '12px ui-sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Visual Concept', 100, 85);
        ctx.fillText('Related Idea', 250, 85);
      }
    }
  };

  if (!visualContent || visualContent.type === 'none') {
    return null;
  }

  return (
    <div className={`visual-content-container bg-[var(--color-card)] rounded-lg p-4 my-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-[var(--color-text-primary)]">
          {visualContent.title || `${visualContent.type.charAt(0).toUpperCase() + visualContent.type.slice(1)} Diagram`}
        </h4>
        <button
          onClick={() => setIsVisible(!isVisible)}
          className="interactive-button p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          title={isVisible ? 'Hide diagram' : 'Show diagram'}
        >
          {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      {isVisible && (
        <div className="visual-content-wrapper">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--color-accent-bg)]"></div>
              <span className="ml-2 text-sm text-[var(--color-text-secondary)]">Rendering diagram...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-700/30 rounded-lg text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!isLoading && !error && (
            <>
              {visualContent.type === 'mermaid' && (
                <div 
                  ref={containerRef}
                  className="mermaid-container overflow-x-auto"
                  style={{ minHeight: '200px' }}
                />
              )}
              
              {visualContent.type === 'rough' && (
                <div ref={containerRef} className="rough-container">
                  <canvas
                    ref={canvasRef}
                    className="max-w-full h-auto border border-[var(--color-border)] rounded"
                    style={{ backgroundColor: 'var(--color-card)' }}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
