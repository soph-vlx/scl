import Tesseract from 'tesseract.js';

export async function processMatchScreenshot(imageData) {
  try {
    let imageBuffer;
    
    if (imageData.startsWith('data:')) {
      const base64Data = imageData.split(',')[1];
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else {
      imageBuffer = Buffer.from(imageData, 'base64');
    }
    
    const result = await Tesseract.recognize(
      imageBuffer,
      'eng',
      {
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      }
    );
    
    const extractedText = result.data.text;
    console.log('OCR Extracted Text:', extractedText);
    
    const matchData = parseMatchResult(extractedText);
    
    return {
      success: true,
      rawText: extractedText,
      confidence: result.data.confidence,
      parsedData: matchData
    };
  } catch (error) {
    console.error('OCR Processing Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

function parseMatchResult(text) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  let homeTeam = null;
  let awayTeam = null;
  let homeScore = null;
  let awayScore = null;
  
  const scorePattern = /(\d+)\s*[-:]\s*(\d+)/;
  const vsPattern = /(.+?)\s+(?:vs?\.?|VS)\s+(.+)/i;
  
  for (const line of lines) {
    const vsMatch = line.match(vsPattern);
    if (vsMatch) {
      homeTeam = vsMatch[1].trim();
      awayTeam = vsMatch[2].trim();
    }
    
    const scoreMatch = line.match(scorePattern);
    if (scoreMatch && homeScore === null) {
      homeScore = parseInt(scoreMatch[1]);
      awayScore = parseInt(scoreMatch[2]);
    }
  }
  
  const teamPattern = /([A-Za-z\s]+?)\s*(\d+)\s*[-:]\s*(\d+)\s*([A-Za-z\s]+)/;
  for (const line of lines) {
    const match = line.match(teamPattern);
    if (match) {
      homeTeam = match[1].trim();
      homeScore = parseInt(match[2]);
      awayScore = parseInt(match[3]);
      awayTeam = match[4].trim();
      break;
    }
  }
  
  return {
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    isComplete: homeTeam && awayTeam && homeScore !== null && awayScore !== null
  };
}

export async function processMultipleScreenshots(screenshots) {
  const results = [];
  
  for (let i = 0; i < screenshots.length; i++) {
    const screenshot = screenshots[i];
    console.log(`Processing screenshot ${i + 1} of ${screenshots.length}...`);
    
    const result = await processMatchScreenshot(screenshot.imageData);
    results.push({
      gameNumber: screenshot.gameNumber || i + 1,
      ...result
    });
  }
  
  return results;
}

export function aggregateMatchResults(gameResults) {
  let homeWins = 0;
  let awayWins = 0;
  const validGames = [];
  
  for (const game of gameResults) {
    if (game.success && game.parsedData.isComplete) {
      validGames.push({
        gameNumber: game.gameNumber,
        homeScore: game.parsedData.homeScore,
        awayScore: game.parsedData.awayScore
      });
      
      if (game.parsedData.homeScore > game.parsedData.awayScore) {
        homeWins++;
      } else if (game.parsedData.awayScore > game.parsedData.homeScore) {
        awayWins++;
      }
    }
  }
  
  const homeTeam = gameResults.find(g => g.success && g.parsedData.homeTeam)?.parsedData.homeTeam || null;
  const awayTeam = gameResults.find(g => g.success && g.parsedData.awayTeam)?.parsedData.awayTeam || null;
  
  return {
    homeTeam,
    awayTeam,
    homeWins,
    awayWins,
    totalGames: validGames.length,
    games: validGames,
    winner: homeWins > awayWins ? 'home' : awayWins > homeWins ? 'away' : 'tie',
    needsReview: validGames.length < 3 || !homeTeam || !awayTeam
  };
}

export default {
  processMatchScreenshot,
  processMultipleScreenshots,
  aggregateMatchResults
};
