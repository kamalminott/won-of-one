// Simple data check for time leading calculations
// Add this to your neutral-match-summary.tsx or run separately

import { matchService } from '@/lib/database';

export async function checkTimeLeadingData(matchId) {
  console.log('🔍 Checking data for time leading calculations...');
  
  try {
    // 1. Get match data
    const matchData = await matchService.getMatchById(matchId);
    console.log('📊 Match Data:', {
      matchId: matchData?.match_id,
      duration: matchData?.bout_length_s,
      fencer1: matchData?.fencer_1_name,
      fencer2: matchData?.fencer_2_name,
      finalScore: `${matchData?.final_score} - ${matchData?.touches_against}`
    });

    // 2. Get match events
    const { data: events, error } = await supabase
      .from('match_event')
      .select('*')
      .eq('match_id', matchId)
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('❌ Error fetching events:', error);
      return;
    }

    console.log(`📊 Found ${events?.length || 0} match events`);

    if (events && events.length > 0) {
      // 3. Analyze event data
      console.log('\n📈 Event Analysis:');
      events.forEach((event, index) => {
        console.log(`Event ${index + 1}:`);
        console.log(`  - Time: ${event.timestamp}`);
        console.log(`  - Scorer: ${event.scoring_user_name}`);
        console.log(`  - Match Time: ${event.match_time_elapsed}s`);
        console.log(`  - Score Diff: ${event.score_diff}`);
        console.log('---');
      });

      // 4. Check data completeness
      const hasAllData = events.every(e => 
        e.timestamp && 
        e.scoring_user_name && 
        e.match_time_elapsed !== null
      );

      console.log('\n✅ Data Completeness Check:');
      console.log(`  - All events have timestamps: ${events.every(e => e.timestamp)}`);
      console.log(`  - All events have scorers: ${events.every(e => e.scoring_user_name)}`);
      console.log(`  - All events have match_time_elapsed: ${events.every(e => e.match_time_elapsed !== null)}`);
      console.log(`  - Match has duration: ${matchData?.bout_length_s > 0}`);
      console.log(`  - Complete data set: ${hasAllData}`);

      if (hasAllData && matchData?.bout_length_s > 0) {
        console.log('\n🎯 SUCCESS: We can calculate time leading percentages!');
        
        // 5. Show what we can calculate
        console.log('\n📊 What we can calculate:');
        console.log(`  - Total match time: ${matchData.bout_length_s} seconds`);
        console.log(`  - Score changes: ${events.length} events`);
        console.log(`  - Time intervals between each score change`);
        console.log(`  - Who was leading during each interval`);
        console.log(`  - Percentage of time each fencer was leading`);
        console.log(`  - Percentage of time tied`);
        
        return {
          canCalculate: true,
          matchDuration: matchData.bout_length_s,
          eventCount: events.length,
          fencer1: matchData.fencer_1_name,
          fencer2: matchData.fencer_2_name
        };
      } else {
        console.log('\n⚠️  WARNING: Missing data for accurate calculation');
        return {
          canCalculate: false,
          missingData: {
            timestamps: !events.every(e => e.timestamp),
            scorers: !events.every(e => e.scoring_user_name),
            matchTime: !events.every(e => e.match_time_elapsed !== null),
            duration: !matchData?.bout_length_s
          }
        };
      }
    }

  } catch (error) {
    console.error('❌ Error checking data:', error);
    return { canCalculate: false, error: error.message };
  }
}

// Usage example:
// checkTimeLeadingData('your-match-id-here');


