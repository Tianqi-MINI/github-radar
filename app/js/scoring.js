/**
 * RadarScoring — deterministic, dependency-free ranking maths.
 *
 * Extracted from the radar UI so the same weights can be reused and unit
 * tested outside the browser. Nothing here touches the DOM or fetches data:
 * callers pass in the item, the curated guide (optional) and the
 * personalisation result (optional).
 *
 * Authority  = community + maturity + maintenance + license + docs + security
 * Freshness  = recent-push curve + a small bonus for new projects
 * Combined   = 62% personal fit + 23% authority + 15% freshness
 */
(function (global) {
  "use strict";

  const Util = global.RadarUtil;
  const clamp = Util.clamp;
  const daysSince = Util.daysSince;

  const COMBINED_WEIGHTS = { personal: 0.62, authority: 0.23, freshness: 0.15 };

  function communityScore(stars) {
    if (stars >= 100_000) return 30;
    if (stars >= 50_000) return 28;
    if (stars >= 20_000) return 25;
    if (stars >= 10_000) return 22;
    if (stars >= 5_000) return 18;
    if (stars >= 2_000) return 14;
    if (stars >= 500) return 9;
    return 5;
  }

  function maturityScore(ageYears) {
    if (ageYears >= 5) return 15;
    if (ageYears >= 3) return 12;
    if (ageYears >= 2) return 10;
    if (ageYears >= 1) return 7;
    if (ageYears >= 0.5) return 5;
    return 3;
  }

  function maintenanceScore(pushedDays) {
    if (pushedDays <= 7) return 20;
    if (pushedDays <= 30) return 18;
    if (pushedDays <= 90) return 15;
    if (pushedDays <= 180) return 12;
    if (pushedDays <= 365) return 8;
    if (pushedDays <= 730) return 4;
    return 1;
  }

  function licenseScore(license) {
    if (/MIT|Apache|BSD/i.test(license)) return 20;
    if (/GPL|AGPL/i.test(license)) return 18;
    return 10;
  }

  function freshnessScore(createdDays, pushedDays) {
    const pushed = pushedDays <= 7 ? 100
      : pushedDays <= 30 ? 92
        : pushedDays <= 90 ? 82
          : pushedDays <= 180 ? 70
            : pushedDays <= 365 ? 55
              : pushedDays <= 730 ? 35
                : 18;
    const newProjectBonus = createdDays <= 365 ? 8 : createdDays <= 730 ? 4 : 0;
    return clamp(pushed + newProjectBonus, 0, 100);
  }

  /**
   * @param {object} item            radar feed item
   * @param {object|null} source     curated guide for the repo, if any
   * @param {object|null} personal   buildPersonalization() output
   */
  function calculateScores(item, source = null, personal = null) {
    const stars = Number(source?.stars ?? item.metrics?.stars ?? 0);
    const docs = Number(source?.documentationQuality ?? item.metrics?.documentationQuality ?? 0);
    const createdDays = daysSince(source?.createdAt ?? item.metrics?.createdAt);
    const pushedDays = daysSince(source?.pushedAt ?? item.metrics?.pushedAt);
    const ageYears = createdDays / 365.25;
    const license = String(source?.license ?? item.metrics?.license ?? "");

    const community = communityScore(stars);
    const maturity = maturityScore(ageYears);
    const maintenance = maintenanceScore(pushedDays);
    const licensePoints = licenseScore(license);
    const documentation = clamp(Math.round(docs), 0, 10);
    const security = source?.security?.status === "passed" ? 5 : 2;
    const authority = community + maturity + maintenance + licensePoints + documentation + security;
    const freshness = freshnessScore(createdDays, pushedDays);
    const personalization = personal ?? {
      score: item.signal ?? 0,
      fitLabel: "等待配置",
      reasons: ["完成配置后会生成个性化推荐理由"],
      components: {},
      matchedTools: [],
      matchedFocus: [],
    };

    return {
      authority,
      freshness,
      profile: personalization.score,
      personalization,
      community,
      maturity,
      maintenance,
      license: licensePoints,
      documentation,
      security,
      createdDays,
      pushedDays,
      licenseName: license,
      stars,
    };
  }

  function recommendationScore(scores) {
    return (
      clamp(scores.profile, 0, 100) * COMBINED_WEIGHTS.personal +
      scores.authority * COMBINED_WEIGHTS.authority +
      scores.freshness * COMBINED_WEIGHTS.freshness
    );
  }

  function recommendationCategory(scores) {
    if (scores.createdDays <= 365 && scores.freshness >= 90) return "近期新秀";
    if (scores.authority >= 82) return "权威基准";
    if (scores.freshness >= 85) return "近期活跃";
    return "稳健开源";
  }

  global.RadarScoring = {
    COMBINED_WEIGHTS,
    calculateScores,
    recommendationScore,
    recommendationCategory,
    communityScore,
    maturityScore,
    maintenanceScore,
    licenseScore,
    freshnessScore,
  };
})(window);
