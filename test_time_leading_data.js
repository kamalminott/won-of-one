// Quick test to check if we have the right data for time leading calculations
// Run this in your React Native app to verify data availability

import { supabase } from './lib/supabase';

export async function testTimeLeadingData() {
  console.log('🧪 Testing Time Leading Data Availability...\n');

  try {
    // Get a recent match to test with
    const { data: recentMatch, error: matchError } = await supabase
      .from('match')
      .select('match_id, bout_length_s, fencer_1_name, fencer_2_name, final_score, touches_against')
      .not('bout_length_s', 'is', null)
      .not('final_score', 'is', null)
      .limit(1)
      .single();

    if (matchError || !recentMatch) {
      console.log('❌ No suitable match found for testing');
      return;
    }

    console.log('📊 Testing with match:', recentMatch.match_id);
    console.log(`Duration: ${recentMatch.bout_length_s}s`);
    console.log(`Fencers: ${recentMatch.fencer_1_name} vs ${recentMatch.fencer_2_name}`);
    console.log(`Final Score: ${recentMatch.final_score} - ${recentMatch.touches_against}\n`);

    // Get events for this match
    const { data: events, error: eventsError } = await supabase
      .from('match_event')
      .select('*')
      .eq('match_id', recentMatch.match_id)
      .order('timestamp', { ascending: true });

    if (eventsError) {
      console.log('❌ Error fetching events:', eventsError);
      return;
    }

    console.log(`📈 Found ${events?.length || 0} events\n`);

    if (!events || events.length === 0) {
      console.log('❌ No events found for this match');
      return;
    }

    // Analyze the data
    console.log('🔍 DATA ANALYSIS:');
    console.log('================');

    // Check each event
    let hasAllRequiredData = true;
    const issues = [];

    events.forEach((event, index) => {
      console.log(`Event ${index + 1}:`);
      console.log(`  Timestamp: ${event.timestamp || 'MISSING'}`);
      console.log(`  Scorer: ${event.scoring_user_name || 'MISSING'}`);
      console.log(`  Match Time: ${event.match_time_elapsed !== null ? event.match_time_elapsed + 's' : 'MISSING'}`);
      console.log(`  Score Diff: ${event.score_diff || 'N/A'}`);
      
      // Check for missing data
      if (!event.timestamp) {
        hasAllRequiredData = false;
        issues.push(`Event ${index + 1}: Missing timestamp`);
      }
      if (!event.scoring_user_name) {
        hasAllRequiredData = false;
        issues.push(`Event ${index + 1}: Missing scorer name`);
      }
      if (event.match_time_elapsed === null || event.match_time_elapsed === undefined) {
        hasAllRequiredData = false;
        issues.push(`Event ${index + 1}: Missing match_time_elapsed`);
      }
      
      console.log('---');
    });

    // Summary
    console.log('\n📋 SUMMARY:');
    console.log('===========');
    console.log(`✅ Match duration: ${recentMatch.bout_length_s}s`);
    console.log(`✅ Event count: ${events.length}`);
    console.log(`✅ Has all required data: ${hasAllRequiredData ? 'YES' : 'NO'}`);

    if (hasAllRequiredData) {
      console.log('\n🎯 RESULT: We can calculate time leading percentages!');
      console.log('\n📊 What we can calculate:');
      console.log(`- Time ${recentMatch.fencer_1_name} was leading`);
      console.log(`- Time ${recentMatch.fencer_2_name} was leading`);
      console.log(`- Time tied`);
      console.log(`- Percentages for each category`);
      
      // Show a sample calculation
      console.log('\n🧮 SAMPLE CALCULATION:');
      console.log('======================');
      console.log('We can track score changes and calculate:');
      console.log('1. Who was leading between each event');
      console.log('2. How long each lead lasted');
      console.log('3. Convert to percentages of total match time');
      
    } else {
      console.log('\n⚠️  ISSUES FOUND:');
      issues.forEach(issue => console.log(`  - ${issue}`));
      console.log('\n💡 RECOMMENDATIONS:');
      console.log('- Ensure all events have timestamps');
      console.log('- Ensure all events have scorer names');
      console.log('- Ensure all events have match_time_elapsed values');
      console.log('- Consider adding a column to track leading status at each event');
    }

    return {
      canCalculate: hasAllRequiredData,
      matchId: recentMatch.match_id,
      duration: recentMatch.bout_length_s,
      eventCount: events.length,
      issues: issues
    };

  } catch (error) {
    console.error('❌ Error in test:', error);
    return { canCalculate: false, error: error.message };
  }
}

// Run the test
// testTimeLeadingData();


