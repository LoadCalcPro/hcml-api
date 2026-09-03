'use strict';

const STANDARD_TRIAL_HOURS = 5 * 24;

// Used only when inserting a new redemption, never to recalculate saved expiry.
// Legacy standard campaigns still store 24 hours. Other custom offers retain
// their configured duration; future standard campaigns should store 120.
function newTrialHours(durationHours) {
  const configured = Number(durationHours);
  if (!Number.isFinite(configured) || configured <= 0 || configured === 24) {
    return STANDARD_TRIAL_HOURS;
  }
  return Math.max(1, configured);
}

function trialDurationLabel(hours) {
  return hours % 24 === 0 ? `${hours / 24}-day` : `${hours}-hour`;
}

module.exports = { STANDARD_TRIAL_HOURS, newTrialHours, trialDurationLabel };
