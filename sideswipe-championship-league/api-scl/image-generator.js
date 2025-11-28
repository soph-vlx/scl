import { createCanvas, registerFont, loadImage } from 'canvas';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

const COLORS = {
  background: '#0a0e1a',
  cardBg: '#131826',
  headerBg: '#1c2333',
  border: '#2a2f42',
  textPrimary: '#e6e6e6',
  textSecondary: '#9ca3af',
  accent: '#6366f1',
  gold: '#ffd700',
  silver: '#c0c0c0',
  bronze: '#cd7f32',
  positive: '#00c853',
  negative: '#ef4444'
};

export async function generateStandingsImage(options = {}) {
  const { currentMatchday = null, title = 'SCL STANDINGS' } = options;
  
  const standings = await prisma.sclStanding.findMany({
    include: { team: true },
    orderBy: [
      { points: 'desc' },
      { goalsFor: 'desc' },
      { goalsAgainst: 'asc' }
    ]
  });
  
  const width = 900;
  const rowHeight = 50;
  const headerHeight = 80;
  const titleHeight = 70;
  const footerHeight = 50;
  const height = titleHeight + headerHeight + (standings.length * rowHeight) + footerHeight + 40;
  
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, width, height);
  
  ctx.fillStyle = COLORS.accent;
  ctx.font = 'bold 32px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(title, width / 2, 45);
  
  if (currentMatchday) {
    ctx.fillStyle = COLORS.textSecondary;
    ctx.font = '16px Arial';
    ctx.fillText(`After Matchday ${currentMatchday}`, width / 2, 65);
  }
  
  const tableY = titleHeight + 10;
  const tableWidth = width - 40;
  const tableX = 20;
  
  ctx.fillStyle = COLORS.headerBg;
  ctx.fillRect(tableX, tableY, tableWidth, headerHeight - 10);
  
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(tableX, tableY, tableWidth, headerHeight - 10);
  
  const columns = [
    { header: '#', width: 40, align: 'center' },
    { header: 'TEAM', width: 220, align: 'left' },
    { header: 'P', width: 50, align: 'center' },
    { header: 'W', width: 50, align: 'center' },
    { header: 'D', width: 50, align: 'center' },
    { header: 'L', width: 50, align: 'center' },
    { header: 'GF', width: 55, align: 'center' },
    { header: 'GA', width: 55, align: 'center' },
    { header: 'GD', width: 60, align: 'center' },
    { header: 'PTS', width: 60, align: 'center' }
  ];
  
  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = 'bold 14px Arial';
  
  let colX = tableX + 15;
  columns.forEach(col => {
    ctx.textAlign = col.align;
    const textX = col.align === 'center' ? colX + col.width / 2 : 
                  col.align === 'left' ? colX : colX + col.width;
    ctx.fillText(col.header, textX, tableY + 45);
    colX += col.width;
  });
  
  const rowsY = tableY + headerHeight - 10;
  
  standings.forEach((standing, index) => {
    const rowY = rowsY + (index * rowHeight);
    const position = index + 1;
    
    ctx.fillStyle = index % 2 === 0 ? COLORS.cardBg : '#0f1420';
    ctx.fillRect(tableX, rowY, tableWidth, rowHeight);
    
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 0.5;
    ctx.strokeRect(tableX, rowY, tableWidth, rowHeight);
    
    if (position <= 3) {
      ctx.fillStyle = position === 1 ? COLORS.gold : 
                      position === 2 ? COLORS.silver : COLORS.bronze;
      ctx.fillRect(tableX, rowY, 4, rowHeight);
    }
    
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = position <= 3 ? 
      (position === 1 ? COLORS.gold : position === 2 ? COLORS.silver : COLORS.bronze) : 
      COLORS.textPrimary;
    ctx.fillText(position.toString(), tableX + 35, rowY + 32);
    
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.textPrimary;
    ctx.font = '15px Arial';
    const teamName = standing.team?.name || 'Unknown';
    ctx.fillText(teamName.substring(0, 20), tableX + 70, rowY + 32);
    
    const gd = standing.goalsFor - standing.goalsAgainst;
    const stats = [
      { value: standing.played, color: COLORS.textPrimary },
      { value: standing.wins, color: COLORS.textPrimary },
      { value: standing.draws, color: COLORS.textPrimary },
      { value: standing.losses, color: COLORS.textPrimary },
      { value: standing.goalsFor, color: COLORS.textPrimary },
      { value: standing.goalsAgainst, color: COLORS.textPrimary },
      { value: (gd > 0 ? '+' : '') + gd, color: gd > 0 ? COLORS.positive : gd < 0 ? COLORS.negative : COLORS.textPrimary },
      { value: standing.points, color: COLORS.accent, bold: true }
    ];
    
    ctx.textAlign = 'center';
    let statX = tableX + 280 + 25;
    stats.forEach((stat, i) => {
      ctx.fillStyle = stat.color;
      ctx.font = stat.bold ? 'bold 16px Arial' : '15px Arial';
      const colWidth = i < 4 ? 50 : i < 6 ? 55 : 60;
      ctx.fillText(stat.value.toString(), statX, rowY + 32);
      statX += colWidth;
    });
  });
  
  const footerY = rowsY + (standings.length * rowHeight) + 20;
  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Sideswipe Championship League • Season 1', width / 2, footerY);
  ctx.fillText(`Generated: ${new Date().toLocaleDateString('en-US', { 
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
  })}`, width / 2, footerY + 18);
  
  return canvas.toBuffer('image/png');
}

export async function generateLeaderboardImage(options = {}) {
  const { limit = 10, title = 'TOP 10 PLAYERS' } = options;
  
  const players = await prisma.sclPlayer.findMany({
    include: { team: true },
    orderBy: [
      { goals: 'desc' },
      { assists: 'desc' }
    ],
    take: limit
  });
  
  const width = 800;
  const rowHeight = 55;
  const headerHeight = 70;
  const titleHeight = 70;
  const footerHeight = 50;
  const height = titleHeight + headerHeight + (players.length * rowHeight) + footerHeight + 40;
  
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, width, height);
  
  ctx.fillStyle = COLORS.accent;
  ctx.font = 'bold 32px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(title, width / 2, 45);
  
  const tableY = titleHeight + 10;
  const tableWidth = width - 40;
  const tableX = 20;
  
  ctx.fillStyle = COLORS.headerBg;
  ctx.fillRect(tableX, tableY, tableWidth, headerHeight - 10);
  
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(tableX, tableY, tableWidth, headerHeight - 10);
  
  const columns = [
    { header: '#', width: 50, align: 'center' },
    { header: 'PLAYER', width: 200, align: 'left' },
    { header: 'TEAM', width: 180, align: 'left' },
    { header: 'GOALS', width: 80, align: 'center' },
    { header: 'ASSISTS', width: 80, align: 'center' },
    { header: 'TOTAL', width: 80, align: 'center' }
  ];
  
  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = 'bold 13px Arial';
  
  let colX = tableX + 10;
  columns.forEach(col => {
    ctx.textAlign = col.align;
    const textX = col.align === 'center' ? colX + col.width / 2 : 
                  col.align === 'left' ? colX : colX + col.width;
    ctx.fillText(col.header, textX, tableY + 40);
    colX += col.width;
  });
  
  const rowsY = tableY + headerHeight - 10;
  
  players.forEach((player, index) => {
    const rowY = rowsY + (index * rowHeight);
    const position = index + 1;
    
    ctx.fillStyle = index % 2 === 0 ? COLORS.cardBg : '#0f1420';
    ctx.fillRect(tableX, rowY, tableWidth, rowHeight);
    
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 0.5;
    ctx.strokeRect(tableX, rowY, tableWidth, rowHeight);
    
    if (position <= 3) {
      ctx.fillStyle = position === 1 ? COLORS.gold : 
                      position === 2 ? COLORS.silver : COLORS.bronze;
      ctx.fillRect(tableX, rowY, 4, rowHeight);
    }
    
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = position <= 3 ? 
      (position === 1 ? COLORS.gold : position === 2 ? COLORS.silver : COLORS.bronze) : 
      COLORS.textPrimary;
    ctx.fillText(position.toString(), tableX + 35, rowY + 35);
    
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.textPrimary;
    ctx.font = 'bold 15px Arial';
    ctx.fillText(player.displayName.substring(0, 18), tableX + 65, rowY + 35);
    
    ctx.fillStyle = COLORS.textSecondary;
    ctx.font = '14px Arial';
    ctx.fillText(player.team?.shortName || player.team?.name?.substring(0, 15) || 'N/A', tableX + 265, rowY + 35);
    
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.textPrimary;
    ctx.font = '15px Arial';
    ctx.fillText((player.goals || 0).toString(), tableX + 485, rowY + 35);
    ctx.fillText((player.assists || 0).toString(), tableX + 565, rowY + 35);
    
    const total = (player.goals || 0) + (player.assists || 0);
    ctx.fillStyle = COLORS.accent;
    ctx.font = 'bold 16px Arial';
    ctx.fillText(total.toString(), tableX + 645, rowY + 35);
  });
  
  const footerY = rowsY + (players.length * rowHeight) + 20;
  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Sideswipe Championship League • Season 1', width / 2, footerY);
  ctx.fillText(`Generated: ${new Date().toLocaleDateString('en-US', { 
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
  })}`, width / 2, footerY + 18);
  
  return canvas.toBuffer('image/png');
}
