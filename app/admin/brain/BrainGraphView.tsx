"use client";

import { useEffect, useRef, useState } from "react";
import { useBrainGraph, useBrainStats, useBrainNodeContext, useBrainMemories } from "@/hooks/useBrain";
import type { BrainNode, BrainEdge, BrainMemory } from "@/hooks/useBrain";
import { useTranslation } from "@/context/LanguageContext";
import styles from "./Brain.module.css";

/* â”€â”€â”€ Hook to detect theme â”€â”€â”€ */
function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof document === "undefined") return true;
    return document.documentElement.classList.contains("dark");
  });

  useEffect(() => {
    const checkDark = () => document.documentElement.classList.contains("dark");
    const observer = new MutationObserver(() => {
      setIsDark(checkDark());
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  return { isDark };
}

/* â”€â”€â”€ Testing Company Colors â”€â”€â”€ */
const TC_PRIMARY = "#011848";  // Dark blue
const TC_ACCENT = "#ef0001";   // Red

/* â”€â”€â”€ Enhanced Color mapping per node type (dark mode) â”€â”€â”€ */
const NODE_COLORS_DARK: Record<string, string> = {
  Company: TC_ACCENT,          // Testing Company red
  Application: "#9c27b0",
  Module: "#ff6d00",
  Ticket: "#ffab00",
  Defect: "#ff1744",
  User: "#00e676",
  Screen: "#e91e63",
  TestRun: "#2196f3",
  Release: "#4caf50",
  Integration: "#ce93d8",
  Note: "#ffc107",
};

/* â”€â”€â”€ Enhanced Color mapping per node type (light mode) â”€â”€â”€ */
const NODE_COLORS_LIGHT: Record<string, string> = {
  Company: TC_PRIMARY,         // Testing Company blue
  Application: "#7b1fa2",
  Module: "#e65100",
  Ticket: "#ff8f00",
  Defect: TC_ACCENT,           // Testing Company red
  User: "#00c853",
  Screen: "#c2185b",
  TestRun: "#1976d2",
  Release: "#388e3c",
  Integration: "#ab47bc",
  Note: "#ffa000",
};

const MEMORY_TYPE_COLORS_DARK: Record<string, string> = {
  DECISION: TC_ACCENT,
  RULE: "#ff6d00",
  PATTERN: "#7c4dff",
  CONTEXT: "#00e676",
  EXCEPTION: "#ff1744",
  TECHNICAL_NOTE: "#ffd740",
};

const MEMORY_TYPE_COLORS_LIGHT: Record<string, string> = {
  DECISION: TC_PRIMARY,
  RULE: "#e65100",
  PATTERN: "#651fff",
  CONTEXT: "#00c853",
  EXCEPTION: TC_ACCENT,
  TECHNICAL_NOTE: "#ffa000",
};

/* â”€â”€â”€ Node type icons (emoji) â”€â”€â”€ */
const NODE_ICONS: Record<string, string> = {
  Company: "C",
  Application: "A",
  Module: "M",
  Ticket: "T",
  Defect: "D",
  User: "U",
  Screen: "S",
  TestRun: "Q",
  Release: "R",
  Integration: "I",
  Note: "N",
};

function getNodeColor(type: string, isDark: boolean) {
  const colors = isDark ? NODE_COLORS_DARK : NODE_COLORS_LIGHT;
  return colors[type] ?? (isDark ? "#78909c" : "#546e7a");
}

function getMemoryTypeColor(memoryType: string, isDark: boolean) {
  const colors = isDark ? MEMORY_TYPE_COLORS_DARK : MEMORY_TYPE_COLORS_LIGHT;
  return colors[memoryType] ?? (isDark ? "#607d8b" : "#455a64");
}

function getNodeIcon(type: string) {
  return NODE_ICONS[type] ?? "*";
}

function getNodeRadius(type: string, isRoot: boolean) {
  if (isRoot) return 46;
  if (type === "Company") return 38;
  if (type === "Application" || type === "Module") return 30;
  return 22;
}

function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + percent);
  const g = Math.min(255, ((num >> 8) & 0xff) + percent);
  const b = Math.min(255, (num & 0xff) + percent);
  return `rgb(${r}, ${g}, ${b})`;
}

function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((num >> 16) & 0xff) - percent);
  const g = Math.max(0, ((num >> 8) & 0xff) - percent);
  const b = Math.max(0, (num & 0xff) - percent);
  return `rgb(${r}, ${g}, ${b})`;
}

/* â”€â”€â”€ Force simulation types â”€â”€â”€ */
type SimNode = BrainNode & { x: number; y: number; vx: number; vy: number; fx?: number | null; fy?: number | null };

function initSimulation(nodes: BrainNode[], edges: BrainEdge[], width: number, height: number) {
  const cx = width / 2;
  const cy = height / 2;
  const spread = Math.min(Math.max(280, Math.sqrt(nodes.length) * 90), 760);

  const simNodes: SimNode[] = nodes.map((n) => ({
    ...n,
    x: n.isRoot ? cx : cx + (Math.random() - 0.5) * spread,
    y: n.isRoot ? cy : cy + (Math.random() - 0.5) * spread,
    vx: 0,
    vy: 0,
    fx: n.isRoot ? cx : null,
    fy: n.isRoot ? cy : null,
  }));

  return simNodes;
}

function tickSimulation(simNodes: SimNode[], edges: BrainEdge[], width: number, height: number) {
  const cx = width / 2;
  const cy = height / 2;
  const alpha = 0.35;
  const nodeMap = new Map(simNodes.map((n) => [n.id, n]));

  // Center gravity
  for (const node of simNodes) {
    if (node.fx != null) { node.x = node.fx; node.y = node.fy!; continue; }
    node.vx += (cx - node.x) * 0.0006;
    node.vy += (cy - node.y) * 0.0006;
  }

  // Stronger repulsion for larger nodes
  for (let i = 0; i < simNodes.length; i++) {
    for (let j = i + 1; j < simNodes.length; j++) {
      const a = simNodes[i];
      const b = simNodes[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = 2600 / (dist * dist);
      dx = (dx / dist) * force;
      dy = (dy / dist) * force;
      if (a.fx == null) { a.vx -= dx; a.vy -= dy; }
      if (b.fx == null) { b.vx += dx; b.vy += dy; }
    }
  }

  // Attraction via edges with longer rest length
  for (const edge of edges) {
    const a = nodeMap.get(edge.source);
    const b = nodeMap.get(edge.target);
    if (!a || !b) continue;
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const force = (dist - 220) * 0.0045;
    dx = (dx / dist) * force;
    dy = (dy / dist) * force;
    if (a.fx == null) { a.vx += dx; a.vy += dy; }
    if (b.fx == null) { b.vx -= dx; b.vy -= dy; }
  }

  // Apply velocity with damping
  for (const node of simNodes) {
    if (node.fx != null) continue;
    node.vx *= 0.55;
    node.vy *= 0.55;
    node.x += node.vx * alpha;
    node.y += node.vy * alpha;
    node.x = Math.max(84, Math.min(width - 84, node.x));
    node.y = Math.max(84, Math.min(height - 84, node.y));
  }
}

/* â”€â”€â”€ Main component â”€â”€â”€ */
export default function BrainGraphView() {
  const { t, locale } = useTranslation();
  const { isDark } = useTheme();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [rootNodeId, setRootNodeId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [filterType, setFilterType] = useState<string | null>(null);
  const [depth, setDepth] = useState(3);
  const [panelOpen, setPanelOpen] = useState(false);
  const [viewScale, setViewScale] = useState(1);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simNodesRef = useRef<SimNode[]>([]);
  const animFrameRef = useRef<number | undefined>(undefined);
  const dragRef = useRef<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);
  const panRef = useRef({ x: 0, y: 0, scale: 1, dragging: false, lastX: 0, lastY: 0 });

  const { data: graphData, isLoading: graphLoading } = useBrainGraph(rootNodeId, depth);
  const { data: stats } = useBrainStats();
  const { data: nodeContext } = useBrainNodeContext(selectedNodeId, depth);
  const { data: memoriesData } = useBrainMemories(selectedNodeId);

  const nodes = graphData?.nodes ?? [];
  const edges = graphData?.edges ?? [];
  const memories: BrainMemory[] = memoriesData?.memories ?? [];

  useEffect(() => {
    if (selectedNodeId) {
      const frame = window.requestAnimationFrame(() => setPanelOpen(true));
      return () => window.cancelAnimationFrame(frame);
    }
  }, [selectedNodeId]);

  // Filter nodes
  const filteredNodes = nodes.filter((n) => {
    if (filterType && n.type !== filterType) return false;
    if (searchText && !n.label.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  const filteredEdges = edges.filter((e) => {
    const sourceOk = filteredNodes.some((n) => n.id === e.source);
    const targetOk = filteredNodes.some((n) => n.id === e.target);
    return sourceOk && targetOk;
  });

  // Initialize simulation when data changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || filteredNodes.length === 0) return;

    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width * (window.devicePixelRatio || 1);
    canvas.height = height * (window.devicePixelRatio || 1);

    simNodesRef.current = initSimulation(filteredNodes, filteredEdges, width, height);
  }, [filteredEdges, filteredNodes, filterType, searchText]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let time = 0;

    // Theme-aware colors
    const bgColors = isDark
      ? { c1: TC_PRIMARY, c2: "#0a1220", c3: "#050a12" }      // Dark: TC blue base
      : { c1: "#f8fafc", c2: "#f1f5f9", c3: "#e2e8f0" };      // Light: slate grays
    const gridColor = isDark
      ? `rgba(239, 0, 1, 0.04)`   // TC red subtle
      : `rgba(1, 24, 72, 0.06)`;  // TC blue subtle
    const accentColor = isDark ? TC_ACCENT : TC_PRIMARY;

    const render = () => {
      time += 0.02;
      const { width, height } = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      
      // Background gradient
      const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.7);
      bgGrad.addColorStop(0, bgColors.c1);
      bgGrad.addColorStop(0.5, bgColors.c2);
      bgGrad.addColorStop(1, bgColors.c3);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Animated grid pattern
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      const gridSize = 60;
      for (let x = (time * 10) % gridSize; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = (time * 10) % gridSize; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const pan = panRef.current;
      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(pan.scale, pan.scale);

      const simNodes = simNodesRef.current;
      const nodeMap = new Map(simNodes.map((n) => [n.id, n]));

      tickSimulation(simNodes, filteredEdges, width, height);

      // Draw curved edges with gradients
      for (const edge of filteredEdges) {
        const from = nodeMap.get(edge.source);
        const to = nodeMap.get(edge.target);
        if (!from || !to) continue;

        const isHighlighted = (selectedNodeId || hoveredNodeId) && 
          (edge.source === selectedNodeId || edge.target === selectedNodeId ||
           edge.source === hoveredNodeId || edge.target === hoveredNodeId);
        
        const fromColor = getNodeColor(from.type, isDark);
        const toColor = getNodeColor(to.type, isDark);
        
        // Calculate curve control point
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const curvature = Math.min(dist * 0.15, 40);
        const cpX = midX - dy * curvature / dist;
        const cpY = midY + dx * curvature / dist;
        
        // Edge glow for highlighted
        if (isHighlighted) {
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.quadraticCurveTo(cpX, cpY, to.x, to.y);
          const glowAlpha = 0.3 + Math.sin(time * 3) * 0.1;
          ctx.strokeStyle = isDark
            ? `rgba(239, 0, 1, ${glowAlpha})`     // TC red glow
            : `rgba(1, 24, 72, ${glowAlpha})`;   // TC blue glow
          ctx.lineWidth = 8;
          ctx.stroke();
        }
        
        // Edge gradient
        const edgeGrad = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
        edgeGrad.addColorStop(0, isHighlighted ? fromColor : fromColor + "80");
        edgeGrad.addColorStop(1, isHighlighted ? toColor : toColor + "80");
        
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.quadraticCurveTo(cpX, cpY, to.x, to.y);
        ctx.strokeStyle = edgeGrad;
        ctx.lineWidth = isHighlighted ? 3 : 2;
        ctx.stroke();
        
        // Animated particle on highlighted edges
        if (isHighlighted) {
          const t = (time * 0.3) % 1;
          const px = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * cpX + t * t * to.x;
          const py = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * cpY + t * t * to.y;
          ctx.beginPath();
          ctx.arc(px, py, 4, 0, Math.PI * 2);
          ctx.fillStyle = accentColor;
          ctx.fill();
        }
      }

      // Draw nodes (sorted sÃ³ selected is on top)
      const sortedNodes = [...simNodes].sort((a, b) => {
        if (a.id === selectedNodeId) return 1;
        if (b.id === selectedNodeId) return -1;
        if (a.id === hoveredNodeId) return 1;
        if (b.id === hoveredNodeId) return -1;
        return 0;
      });

      // Theme-aware node colors
      const labelBg = isDark ? "rgba(10, 15, 30, 0.85)" : "rgba(255, 255, 255, 0.95)";
      const labelText = isDark ? "#ffffff" : TC_PRIMARY;
      const borderDefault = isDark ? "rgba(255,255,255,0.3)" : "rgba(1, 24, 72, 0.3)";
      const borderSelected = isDark ? "#ffffff" : TC_PRIMARY;

      for (const node of sortedNodes) {
        const color = getNodeColor(node.type, isDark);
        const baseRadius = getNodeRadius(node.type, node.isRoot ?? false);
        const isSelected = node.id === selectedNodeId;
        const isHovered = node.id === hoveredNodeId;
        const radius = baseRadius + (isSelected ? 6 : isHovered ? 3 : 0);
        
        // Outer glow ring (animated)
        if (isSelected || isHovered || node.isRoot) {
          const glowRadius = radius + 20 + Math.sin(time * 2) * 4;
          const glowGrad = ctx.createRadialGradient(node.x, node.y, radius, node.x, node.y, glowRadius);
          glowGrad.addColorStop(0, color + "50");
          glowGrad.addColorStop(0.6, color + "20");
          glowGrad.addColorStop(1, "transparent");
          ctx.beginPath();
          ctx.arc(node.x, node.y, glowRadius, 0, Math.PI * 2);
          ctx.fillStyle = glowGrad;
          ctx.fill();
        }

        // Shadow
        ctx.beginPath();
        ctx.arc(node.x + 3, node.y + 3, radius, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? "rgba(0, 0, 0, 0.3)" : "rgba(0, 0, 0, 0.15)";
        ctx.fill();

        // Node fill with gradient
        const nodeGrad = ctx.createRadialGradient(node.x - radius * 0.3, node.y - radius * 0.3, 0, node.x, node.y, radius);
        nodeGrad.addColorStop(0, lightenColor(color, isDark ? 40 : 30));
        nodeGrad.addColorStop(0.7, color);
        nodeGrad.addColorStop(1, darkenColor(color, isDark ? 30 : 20));
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = nodeGrad;
        ctx.fill();
        
        // Border ring
        ctx.strokeStyle = isSelected ? borderSelected : isHovered ? lightenColor(color, 50) : borderDefault;
        ctx.lineWidth = isSelected ? 4 : isHovered ? 3 : 2;
        ctx.stroke();

        // Inner highlight (glass effect)
        ctx.beginPath();
        ctx.arc(node.x, node.y - radius * 0.2, radius * 0.7, Math.PI, 0);
        const innerGrad = ctx.createLinearGradient(node.x, node.y - radius, node.x, node.y);
        innerGrad.addColorStop(0, "rgba(255,255,255,0.35)");
        innerGrad.addColorStop(1, "transparent");
        ctx.fillStyle = innerGrad;
        ctx.fill();

        // Icon inside node
        const icon = getNodeIcon(node.type);
        ctx.font = `${radius * 0.8}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.fillText(icon, node.x, node.y);

        // Label with rounded background
        const label = node.label.length > 22 ? `${node.label.slice(0, 20)}...` : node.label;
        ctx.font = `${isSelected ? "bold " : ""}${radius > 26 ? 14 : 12}px Inter, system-ui, sans-serif`;
        const labelWidth = ctx.measureText(label).width;
        const labelY = node.y + radius + 14;
        
        // Label background pill
        ctx.beginPath();
        const pillPadX = 8, pillPadY = 4;
        const pillX = node.x - labelWidth / 2 - pillPadX;
        const pillY = labelY - 8 - pillPadY;
        const pillW = labelWidth + pillPadX * 2;
        const pillH = 18 + pillPadY;
        const pillR = 8;
        ctx.moveTo(pillX + pillR, pillY);
        ctx.lineTo(pillX + pillW - pillR, pillY);
        ctx.arcTo(pillX + pillW, pillY, pillX + pillW, pillY + pillR, pillR);
        ctx.lineTo(pillX + pillW, pillY + pillH - pillR);
        ctx.arcTo(pillX + pillW, pillY + pillH, pillX + pillW - pillR, pillY + pillH, pillR);
        ctx.lineTo(pillX + pillR, pillY + pillH);
        ctx.arcTo(pillX, pillY + pillH, pillX, pillY + pillH - pillR, pillR);
        ctx.lineTo(pillX, pillY + pillR);
        ctx.arcTo(pillX, pillY, pillX + pillR, pillY, pillR);
        ctx.closePath();
        ctx.fillStyle = labelBg;
        ctx.fill();
        ctx.strokeStyle = color + "60";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Label text
        ctx.fillStyle = labelText;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, node.x, labelY);

        // Type badge below label
        ctx.font = `600 10px Inter, system-ui, sans-serif`;
        ctx.fillStyle = color;
        ctx.fillText(node.type, node.x, labelY + 16);
      }

      ctx.restore();
      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [filteredEdges, selectedNodeId, hoveredNodeId, isDark]);

  // Mouse interaction
  function findNodeAtPoint(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const pan = panRef.current;
    const mx = (clientX - rect.left - pan.x) / pan.scale;
    const my = (clientY - rect.top - pan.y) / pan.scale;

    for (let i = simNodesRef.current.length - 1; i >= 0; i--) {
      const node = simNodesRef.current[i];
      const r = getNodeRadius(node.type, node.isRoot ?? false);
      const dx = mx - node.x;
      const dy = my - node.y;
      if (dx * dx + dy * dy <= (r + 4) * (r + 4)) return node;
    }
    return null;
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const node = findNodeAtPoint(e.clientX, e.clientY);
    if (node) {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const pan = panRef.current;
      const mx = (e.clientX - rect.left - pan.x) / pan.scale;
      const my = (e.clientY - rect.top - pan.y) / pan.scale;
      dragRef.current = { nodeId: node.id, offsetX: mx - node.x, offsetY: my - node.y };
      node.fx = node.x;
      node.fy = node.y;
      return;
    }

    panRef.current.dragging = true;
    panRef.current.lastX = e.clientX;
    panRef.current.lastY = e.clientY;
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (dragRef.current) {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const pan = panRef.current;
      const mx = (e.clientX - rect.left - pan.x) / pan.scale;
      const my = (e.clientY - rect.top - pan.y) / pan.scale;
      const node = simNodesRef.current.find((entry) => entry.id === dragRef.current!.nodeId);
      if (node) {
        node.fx = mx - dragRef.current.offsetX;
        node.fy = my - dragRef.current.offsetY;
        node.x = node.fx;
        node.y = node.fy;
      }
      return;
    }

    if (panRef.current.dragging) {
      panRef.current.x += e.clientX - panRef.current.lastX;
      panRef.current.y += e.clientY - panRef.current.lastY;
      panRef.current.lastX = e.clientX;
      panRef.current.lastY = e.clientY;
      return;
    }

    const hoverNode = findNodeAtPoint(e.clientX, e.clientY);
    setHoveredNodeId(hoverNode?.id ?? null);
  }

  function handleMouseUp() {
    if (dragRef.current) {
      const node = simNodesRef.current.find((entry) => entry.id === dragRef.current!.nodeId);
      if (node) {
        node.fx = null;
        node.fy = null;
      }
      setSelectedNodeId(dragRef.current.nodeId);
      dragRef.current = null;
      return;
    }

    panRef.current.dragging = false;
  }

  function handleWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const pan = panRef.current;
    const zoomFactor = e.deltaY > 0 ? 0.92 : 1.08;
    const newScale = Math.max(0.2, Math.min(5, pan.scale * zoomFactor));

    pan.x = mx - ((mx - pan.x) / pan.scale) * newScale;
    pan.y = my - ((my - pan.y) / pan.scale) * newScale;
    pan.scale = newScale;
    setViewScale(Number(newScale.toFixed(2)));
  }

  function handleDoubleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const node = findNodeAtPoint(e.clientX, e.clientY);
    if (node) {
      setRootNodeId(node.id);
      setSelectedNodeId(node.id);
      panRef.current = { x: 0, y: 0, scale: 1, dragging: false, lastX: 0, lastY: 0 };
      setViewScale(1);
    }
  }

  function resetViewport() {
    panRef.current = { x: 0, y: 0, scale: 1, dragging: false, lastX: 0, lastY: 0 };
    setViewScale(1);
  }

  function clearBrainFilters() {
    setSearchText("");
    setFilterType(null);
    setRootNodeId(null);
    resetViewport();
  }

  // Node types present for filter buttons
  const nodeTypes = Array.from(new Set(nodes.map((n) => n.type))).sort();

  // Selected node context
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const nodeNeighbors = nodeContext?.context?.neighbors ?? [];
  const nodeOutgoing = nodeContext?.context?.outgoing ?? [];
  const nodeIncoming = nodeContext?.context?.incoming ?? [];
  const isPanelVisible = panelOpen && (!!selectedNode || !!stats);
  const recentActivity = stats?.recentActivity?.slice(0, 6) ?? [];
  const topNodeTypes = stats?.breakdown?.nodesByType?.slice(0, 6) ?? [];
  const impactData = nodeContext?.impact;
  const impactedNodes = impactData?.impactedNodes ?? [];
  const impactPaths = impactData?.paths ?? [];

  return (
    <div className={styles.brainPage}>
      {/* Top bar */}
      <div className={styles.topBar}>
        <div className={styles.topBarMain}>
          <div className={styles.titleBlock}>
            <div className={styles.title}>
              <span className={styles.pulseOrb} />
              {t.brain.title} - {t.brain.subtitle}
            </div>
            <div className={styles.subtitleMeta}>
              {locale === "pt"
                ? `Exploracao em profundidade ${depth} com ${filteredNodes.length} nos visiveis.`
                : `Depth ${depth} exploration with ${filteredNodes.length} visible nodes.`}
            </div>
          </div>

          <div className={styles.controlCluster}>
            <input
              className={styles.searchInput}
              placeholder={t.brain.searchPlaceholder}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />

            <div className={styles.depthControl}>
              <button
                type="button"
                className={styles.filterBtn}
                onClick={() => setDepth((current) => Math.max(1, current - 1))}
                disabled={depth <= 1}
              >
                -1
              </button>
              <span className={styles.depthBadge}>
                {locale === "pt" ? `Profundidade ${depth}` : `Depth ${depth}`}
              </span>
              <button
                type="button"
                className={styles.filterBtn}
                onClick={() => setDepth((current) => Math.min(4, current + 1))}
                disabled={depth >= 4}
              >
                +1
              </button>
            </div>

            <button type="button" className={styles.filterBtn} onClick={resetViewport}>
              {`Zoom ${Math.round(viewScale * 100)}%`}
            </button>

            <button type="button" className={styles.filterBtn} onClick={clearBrainFilters}>
              {locale === "pt" ? "Limpar foco" : "Clear focus"}
            </button>

            <button
              type="button"
              className={panelOpen ? styles.filterBtnActive : styles.filterBtn}
              onClick={() => setPanelOpen((current) => !current)}
            >
              {locale === "pt" ? "Painel" : "Panel"}
            </button>
          </div>
        </div>

        <div className={styles.filterRow}>
          {nodeTypes.map((type) => (
            <button
              key={type}
              className={filterType === type ? styles.filterBtnActive : styles.filterBtn}
              onClick={() => setFilterType(filterType === type ? null : type)}
            >
              <span
                className={styles.filterDot}
                data-color={getNodeColor(type, isDark)}
                ref={(el) => { if (el) el.style.setProperty("--dot-color", getNodeColor(type, isDark)); }}
              />
              {type}
            </button>
          ))}

          {rootNodeId && (
            <button
              type="button"
              className={styles.filterBtn}
              onClick={() => {
                setRootNodeId(null);
                resetViewport();
              }}
            >
              {locale === "pt" ? "Resetar raiz" : "Reset root"}
            </button>
          )}
        </div>

        <div className={styles.statsBar}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{stats?.integrity?.stats?.nodes ?? "-"}</span>
            <span className={styles.statLabel}>{t.brain.stats.nodes}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{stats?.integrity?.stats?.edges ?? "-"}</span>
            <span className={styles.statLabel}>{t.brain.stats.edges}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{stats?.integrity?.stats?.memories ?? "-"}</span>
            <span className={styles.statLabel}>{t.brain.stats.memories}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{filteredNodes.length}</span>
            <span className={styles.statLabel}>{locale === "pt" ? "Visiveis" : "Visible"}</span>
          </div>
        </div>
      </div>
      {/* Main area */}
      <div className={styles.mainArea}>
        <div className={styles.graphContainer}>
          <div className={styles.graphHud}>
            <div className={styles.graphHudGroup}>
              <span className={styles.hudPill}>
                {rootNodeId
                  ? `${locale === "pt" ? "Raiz" : "Root"}: ${selectedNode?.id === rootNodeId ? selectedNode.label : rootNodeId.slice(0, 8)}`
                  : locale === "pt" ? "Mapa global" : "Global map"}
              </span>
              <span className={styles.hudPill}>{filteredNodes.length} {locale === "pt" ? "nos" : "nodes"}</span>
              <span className={styles.hudPill}>{filteredEdges.length} {locale === "pt" ? "conexoes" : "edges"}</span>
            </div>
            <div className={styles.graphHudGroup}>
              <button type="button" className={styles.hudButton} onClick={resetViewport}>
                {locale === "pt" ? "Centralizar" : "Center"}
              </button>
              <button type="button" className={styles.hudButton} onClick={() => setPanelOpen((current) => !current)}>
                {panelOpen ? (locale === "pt" ? "Ocultar painel" : "Hide panel") : (locale === "pt" ? "Mostrar painel" : "Show panel")}
              </button>
            </div>
          </div>

          {graphLoading ? (
            <div className={styles.emptyState}>
              <div className={styles.pulseOrbLg} />
              <span>{t.common.loading}</span>
            </div>
          ) : filteredNodes.length === 0 ? (
          <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>*</div>
              <span>{t.brain.empty.title}</span>
              <span className={styles.emptyDescription}>{t.brain.empty.description}</span>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              className={`${styles.graphCanvas} ${hoveredNodeId ? styles.graphCanvasHover : ""}`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => { handleMouseUp(); setHoveredNodeId(null); }}
              onWheel={handleWheel}
              onDoubleClick={handleDoubleClick}
            />
          )}
        </div>

        <div className={isPanelVisible ? styles.sidePanel : styles.sidePanelHidden}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>{selectedNode ? selectedNode.label : (locale === "pt" ? "Visao do Brain" : "Brain overview")}</h2>
              <p className={styles.panelSubtitle}>
                {selectedNode
                  ? `${selectedNode.type}${selectedNode.refId ? ` - ${selectedNode.refId.slice(0, 8)}` : ""}`
                  : (locale === "pt" ? "Contexto, profundidade e atividade recente." : "Context, depth and recent activity.")}
              </p>
            </div>
            <button type="button" className={styles.panelCloseBtn} onClick={() => setPanelOpen(false)}>
              {locale === "pt" ? "Fechar" : "Close"}
            </button>
          </div>

          {!selectedNode ? (
            <>
              <div className={styles.panelSection}>
                <p className={styles.panelSectionTitle}>{locale === "pt" ? "Estado atual" : "Current state"}</p>
                <div className={styles.metadataItem}>
                  <span className={styles.metadataKey}>{locale === "pt" ? "Profundidade" : "Depth"}</span>
                  <span className={styles.metadataValue}>{depth}</span>
                </div>
                <div className={styles.metadataItem}>
                  <span className={styles.metadataKey}>{locale === "pt" ? "Zoom" : "Zoom"}</span>
                  <span className={styles.metadataValue}>{Math.round(viewScale * 100)}%</span>
                </div>
                <div className={styles.metadataItem}>
                  <span className={styles.metadataKey}>{locale === "pt" ? "Raiz" : "Root"}</span>
                  <span className={styles.metadataValue}>{rootNodeId ? rootNodeId.slice(0, 8) : (locale === "pt" ? "Global" : "Global")}</span>
                </div>
                <div className={styles.metadataItem}>
                  <span className={styles.metadataKey}>{locale === "pt" ? "Filtro" : "Filter"}</span>
                  <span className={styles.metadataValue}>{filterType ?? (locale === "pt" ? "Todos" : "All")}</span>
                </div>
              </div>

              {topNodeTypes.length > 0 ? (
                <div className={styles.panelSection}>
                  <p className={styles.panelSectionTitle}>{locale === "pt" ? "Tipos dominantes" : "Top node types"}</p>
                  {topNodeTypes.map((item) => (
                    <div key={item.type} className={styles.metadataItem}>
                      <span className={styles.metadataKey}>{item.type}</span>
                      <span className={styles.metadataValue}>{item.count}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              {recentActivity.length > 0 ? (
                <div className={styles.panelSection}>
                  <p className={styles.panelSectionTitle}>{locale === "pt" ? "Atividade recente" : "Recent activity"}</p>
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className={styles.memoryCard}>
                      <p className={styles.memoryTitle}>{activity.action}</p>
                      <p className={styles.memorySummary}>{activity.reason ?? activity.entityType}</p>
                      <span className={styles.memoryBadgeDynamic}>{new Date(activity.createdAt).toLocaleString(locale === "pt" ? "pt-BR" : "en-US")}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <>
              {selectedNode.description && (
                <div className={styles.panelSection}>
                  <p className={styles.panelSectionTitle}>{locale === "pt" ? "Descricao" : "Description"}</p>
                  <p className={styles.memorySummary}>{selectedNode.description}</p>
                </div>
              )}

              {selectedNode.metadata && Object.keys(selectedNode.metadata).length > 0 && (
                <div className={styles.panelSection}>
                  <p className={styles.panelSectionTitle}>{locale === "pt" ? "Metadados" : "Metadata"}</p>
                  {Object.entries(selectedNode.metadata).map(([key, val]) => (
                    <div key={key} className={styles.metadataItem}>
                      <span className={styles.metadataKey}>{key}</span>
                      <span className={styles.metadataValue}>{String(val)}</span>
                    </div>
                  ))}
                </div>
              )}

              {nodeNeighbors.length > 0 && (
                <div className={styles.panelSection}>
                  <p className={styles.panelSectionTitle}>
                    {t.brain.panel.connections} ({nodeOutgoing.length} {locale === "pt" ? "saida" : "out"}, {nodeIncoming.length} {locale === "pt" ? "entrada" : "in"})
                  </p>
                  {nodeNeighbors.slice(0, 20).map((neighbor: BrainNode & { id: string; label: string; type: string }) => {
                    const outEdge = nodeOutgoing.find((e: { toId: string; type: string }) => e.toId === neighbor.id);
                    const inEdge = nodeIncoming.find((e: { fromId: string; type: string }) => e.fromId === neighbor.id);
                    const edgeType = outEdge?.type ?? inEdge?.type ?? "";

                    return (
                      <div key={neighbor.id} className={styles.neighborItem} onClick={() => setSelectedNodeId(neighbor.id)}>
                        <span className={styles.neighborDot} ref={(el) => { if (el) el.style.setProperty("--dot-color", getNodeColor(neighbor.type, isDark)); }} />
                        <span>{neighbor.label}</span>
                        <span className={styles.neighborEdgeType}>{edgeType}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {memories.length > 0 && (
                <div className={styles.panelSection}>
                  <p className={styles.panelSectionTitle}>{t.brain.panel.memories} ({memories.length})</p>
                  {memories.map((m) => (
                    <div key={m.id} className={styles.memoryCard}>
                      <p className={styles.memoryTitle}>{m.title}</p>
                      <p className={styles.memorySummary}>{m.summary}</p>
                      <span
                        className={styles.memoryBadgeDynamic}
                        ref={(el) => {
                          if (el) {
                            const c = getMemoryTypeColor(m.memoryType, isDark);
                            el.style.setProperty("--badge-bg", c + "20");
                            el.style.setProperty("--badge-color", c);
                          }
                        }}
                      >
                        {m.memoryType} - I{m.importance}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {impactedNodes.length > 0 && (
                <div className={styles.panelSection}>
                  <p className={styles.panelSectionTitle}>
                    {locale === "pt" ? "Impacto" : "Impact"} ({impactedNodes.length} {locale === "pt" ? "nos afetados" : "affected nodes"})
                  </p>
                  {impactPaths.slice(0, 10).map((p: { nodeId: string; edgeType: string; distance: number }, i: number) => {
                    const impactNode = impactedNodes.find((n: BrainNode) => n.id === p.nodeId);
                    return (
                      <div key={i} className={styles.neighborItem} onClick={() => setSelectedNodeId(p.nodeId)}>
                        <span className={styles.neighborDot} ref={(el) => { if (el) el.style.setProperty("--dot-color", getNodeColor(impactNode?.type ?? "", isDark)); }} />
                        <span>{impactNode?.label ?? p.nodeId.slice(0, 8)}</span>
                        <span className={styles.neighborEdgeType}>{p.edgeType} (d {p.distance})</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {/* Legend */}
      <div className={styles.legend}>
        {Object.entries(isDark ? NODE_COLORS_DARK : NODE_COLORS_LIGHT).map(([type, color]) => (
          <div key={type} className={styles.legendItem}>
            <span className={styles.legendDot} ref={(el) => { if (el) el.style.setProperty("--dot-color", color); }} />
            {type}
          </div>
        ))}
        <div className={styles.legendHint}>
          {locale === "pt"
            ? "Clique = selecionar | Duplo clique = explorar | Scroll = zoom | Arrastar = mover"
            : "Click = select | Double click = explore | Scroll = zoom | Drag = move"
          }
        </div>
      </div>
    </div>
  );
}


