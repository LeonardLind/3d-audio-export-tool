// Unit tests for the pure selection logic of tools/download_corpus.js (no network).
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  slugify,
  taxonMatches,
  extensionFromUrl,
  observationToCandidate,
  rankCandidates,
  selectCandidates,
  commonsArtistName,
  inatQueryUrl,
} = require("../download_corpus");

function obs(id, { votes = 0, login = `u${id}`, license = "cc-by", taxon = "Parus major", extra = {}, sounds } = {}) {
  return {
    id,
    uri: `https://www.inaturalist.org/observations/${id}`,
    quality_grade: "research",
    cached_votes_total: votes,
    captive: false,
    user: { login, name: null },
    taxon: { name: taxon, preferred_common_name: "Great Tit" },
    observed_on: "2024-01-01",
    place_guess: "Somewhere",
    sounds: sounds || [{ id: id * 10, license_code: license, attribution: "(c) x", file_url: `https://static.inaturalist.org/sounds/${id * 10}.wav?1`, flags: [], hidden: false }],
    ...extra,
  };
}

test("slugify and extension", () => {
  assert.equal(slugify("Troglodytes troglodytes"), "troglodytes_troglodytes");
  assert.equal(extensionFromUrl("https://static.inaturalist.org/sounds/1227699.wav?1728743480"), ".wav");
  assert.equal(extensionFromUrl("https://static.inaturalist.org/sounds/5.M4A"), ".m4a");
});

test("taxon match accepts the species and its trinomials only", () => {
  assert.ok(taxonMatches("Parus major", "Parus major"));
  assert.ok(taxonMatches("Parus major major", "Parus major"));
  assert.ok(!taxonMatches("Parus majorx", "Parus major"));
  assert.ok(!taxonMatches("Parus", "Parus major"));
  assert.ok(!taxonMatches("Corvus corone × cornix", "Corvus corone"));
  assert.ok(!taxonMatches("Parus major major x", "Parus major"));
  assert.ok(taxonMatches("Luscinia svecica cyanecula", "Luscinia svecica"));
});

test("the SOUND licence decides, not the observation licence", () => {
  const a = observationToCandidate(obs(1, { license: "cc-by-nc", extra: { license_code: "cc0" } }), "Parus major");
  assert.match(a.reject, /no eligible sound/);
  const b = observationToCandidate(obs(2, { license: "CC0", extra: { license_code: null } }), "Parus major");
  assert.equal(b.candidate.license, "cc0");
});

test("pre-filters: quality grade, captive, taxon, hidden/flagged sounds", () => {
  assert.match(observationToCandidate(obs(1, { extra: { quality_grade: "needs_id" } }), "Parus major").reject, /quality_grade/);
  assert.match(observationToCandidate(obs(1, { extra: { captive: true } }), "Parus major").reject, /captive/);
  assert.match(observationToCandidate(obs(1, { taxon: "Cyanistes caeruleus" }), "Parus major").reject, /taxon mismatch/);
  const flagged = obs(1, {
    sounds: [
      { id: 7, license_code: "cc-by", file_url: "https://x/7.mp3", flags: [{ flag: "spam" }] },
      { id: 8, license_code: "cc-by", file_url: "https://x/8.mp3", flags: [], hidden: false },
    ],
  });
  assert.equal(observationToCandidate(flagged, "Parus major").candidate.soundId, 8);
});

test("ranking: votes desc then observation id asc, independent of API order", () => {
  const cands = [obs(30, { votes: 1 }), obs(10, { votes: 0 }), obs(20, { votes: 1 }), obs(5, { votes: 0 })].map(
    (o) => observationToCandidate(o, "Parus major").candidate,
  );
  assert.deepEqual(rankCandidates(cands).map((c) => c.observationId), [20, 30, 5, 10]);
});

test("selection prefers distinct users, caps at 2 per user, logs rejects, checks each once", async () => {
  const ranked = rankCandidates(
    [
      obs(1, { login: "alice" }),
      obs(2, { login: "alice" }),
      obs(3, { login: "alice" }),
      obs(4, { login: "bob" }),
      obs(5, { login: "carol" }),
      obs(6, { login: "dave" }),
    ].map((o) => observationToCandidate(o, "Parus major").candidate),
  );
  const checked = [];
  const check = async (c) => {
    checked.push(c.observationId);
    if (c.observationId === 5) return { ok: false, reason: "duration 3.00 s outside 5-120 s" };
    return { ok: true, record: { id: c.observationId, user: c.userLogin } };
  };
  const out = await selectCandidates(ranked, check, { target: 5, maxPerUser: 2 });
  // pass 1: 1 (alice), 4 (bob), 5 (carol, rejected), 6 (dave); pass 2: 2 (alice's second)
  assert.deepEqual(out.selected.map((r) => r.id), [1, 4, 6, 2]);
  assert.deepEqual(out.rejected, [{ observationId: 5, soundId: 50, reason: "duration 3.00 s outside 5-120 s" }]);
  assert.deepEqual(checked, [1, 4, 5, 6, 2]);
  assert.equal(out.untriedCandidates, 1); // obs 3: alice's third, blocked by the cap
});

test("Commons artist: first link with visible text", () => {
  assert.equal(commonsArtistName('<a href="//commons.wikimedia.org/wiki/User:A">Vladimir Yu. Arkhipov, Arkhivov</a>'), "Vladimir Yu. Arkhipov, Arkhivov");
  const table = '<table><tr><td><a href="x"><img src="y"></a></td><td>created by user <a href="z">Justin Jansen</a> at <a href="w">Waarneming.nl</a></td></tr></table>';
  assert.equal(commonsArtistName(table), "Justin Jansen");
  assert.equal(commonsArtistName("Plain Name"), "Plain Name");
});

test("iNat query carries the documented filters", () => {
  const u = new URL(inatQueryUrl("Strix aluco"));
  assert.equal(u.searchParams.get("taxon_name"), "Strix aluco");
  assert.equal(u.searchParams.get("sound_license"), "cc0,cc-by,cc-by-sa");
  assert.equal(u.searchParams.get("quality_grade"), "research");
  assert.equal(u.searchParams.get("order_by"), "votes");
  assert.equal(u.searchParams.get("per_page"), "200");
});
