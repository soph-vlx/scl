import axios from 'axios';

const TOORNAMENT_BASE_URL = 'https://api.toornament.com';

class ToornamentClient {
  constructor() {
    this.apiKey = process.env.TOORNAMENT_API_KEY;
    this.clientId = process.env.TOORNAMENT_CLIENT_ID;
    this.clientSecret = process.env.TOORNAMENT_CLIENT_SECRET;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(
        'https://api.toornament.com/oauth/v2/token',
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          scope: 'organizer:view organizer:result organizer:participant organizer:registration'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in - 60) * 1000;
      return this.accessToken;
    } catch (error) {
      console.error('Toornament OAuth error:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with Toornament API');
    }
  }

  async makeRequest(endpoint, options = {}) {
    const token = await this.getAccessToken();
    
    const config = {
      method: options.method || 'GET',
      url: `${TOORNAMENT_BASE_URL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Api-Key': this.apiKey,
        ...options.headers
      },
      params: options.params
    };

    if (options.data) {
      config.data = options.data;
    }

    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error('Toornament API error:', error.response?.data || error.message);
      throw error;
    }
  }

  async getTournaments() {
    return this.makeRequest('/organizer/v2/tournaments', {
      headers: { 'Range': 'tournaments=0-49' }
    });
  }

  async getTournament(tournamentId) {
    return this.makeRequest(`/organizer/v2/tournaments/${tournamentId}`);
  }

  async getParticipants(tournamentId, range = '0-49') {
    return this.makeRequest(`/organizer/v2/tournaments/${tournamentId}/participants`, {
      headers: { 'Range': `participants=${range}` }
    });
  }

  async getStages(tournamentId) {
    return this.makeRequest(`/organizer/v2/tournaments/${tournamentId}/stages`, {
      headers: { 'Range': 'stages=0-49' }
    });
  }

  async getGroups(tournamentId, stageId) {
    return this.makeRequest(`/organizer/v2/tournaments/${tournamentId}/stages/${stageId}/groups`, {
      headers: { 'Range': 'groups=0-49' }
    });
  }

  async getRankings(tournamentId, stageId, groupId = null) {
    let endpoint = `/organizer/v2/tournaments/${tournamentId}/stages/${stageId}/ranking-items`;
    const params = {};
    if (groupId) {
      params.group_ids = groupId;
    }
    return this.makeRequest(endpoint, {
      headers: { 'Range': 'items=0-49' },
      params
    });
  }

  async getMatches(tournamentId, options = {}) {
    const params = {};
    if (options.stageId) params.stage_ids = options.stageId;
    if (options.groupId) params.group_ids = options.groupId;
    if (options.roundId) params.round_ids = options.roundId;
    if (options.status) params.statuses = options.status;
    
    return this.makeRequest(`/organizer/v2/tournaments/${tournamentId}/matches`, {
      headers: { 'Range': 'matches=0-127' },
      params
    });
  }

  async getMatch(tournamentId, matchId) {
    return this.makeRequest(`/organizer/v2/tournaments/${tournamentId}/matches/${matchId}`);
  }

  async getMatchGames(tournamentId, matchId) {
    return this.makeRequest(`/organizer/v2/tournaments/${tournamentId}/matches/${matchId}/games`, {
      headers: { 'Range': 'games=0-19' }
    });
  }

  async updateMatchResult(tournamentId, matchId, opponents) {
    return this.makeRequest(`/organizer/v2/tournaments/${tournamentId}/matches/${matchId}`, {
      method: 'PATCH',
      data: { opponents }
    });
  }

  async getRounds(tournamentId, stageId) {
    return this.makeRequest(`/organizer/v2/tournaments/${tournamentId}/stages/${stageId}/rounds`, {
      headers: { 'Range': 'rounds=0-49' }
    });
  }

  async getStandings(tournamentId, stageId) {
    const rankings = await this.getRankings(tournamentId, stageId);
    
    return rankings.map((item, index) => ({
      position: item.position || index + 1,
      participantId: item.participant?.id,
      teamName: item.participant?.name || 'Unknown',
      played: item.properties?.played || 0,
      wins: item.properties?.wins || 0,
      draws: item.properties?.draws || 0,
      losses: item.properties?.losses || 0,
      goalsFor: item.properties?.score_for || 0,
      goalsAgainst: item.properties?.score_against || 0,
      goalDifference: (item.properties?.score_for || 0) - (item.properties?.score_against || 0),
      points: item.properties?.points || item.points || 0
    }));
  }

  async getFormattedMatches(tournamentId, stageId = null) {
    const options = stageId ? { stageId } : {};
    const matches = await this.getMatches(tournamentId, options);
    
    return matches.map(match => ({
      id: match.id,
      roundId: match.round_id,
      groupId: match.group_id,
      stageId: match.stage_id,
      number: match.number,
      status: match.status,
      scheduledAt: match.scheduled_datetime,
      playedAt: match.played_at,
      opponents: match.opponents?.map(opp => ({
        participantId: opp.participant?.id,
        teamName: opp.participant?.name || 'TBD',
        score: opp.score,
        result: opp.result
      })) || []
    }));
  }
}

export const toornamentClient = new ToornamentClient();
export default toornamentClient;
