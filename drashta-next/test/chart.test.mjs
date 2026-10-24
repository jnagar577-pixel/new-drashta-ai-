import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
import * as C from "../lib/chart.js"; import { resolvePlace } from "../lib/places.js";
const diff = (a,b) => Math.abs(mod(a-b+180)-180); const mod = x => ((x%360)+360)%360;
const fx = JSON.parse(fs.readFileSync(new URL("./fixtures/parity.json", import.meta.url)));

test("JD of J2000", () => assert.equal(C.jdFromDate(new Date("2000-01-01T12:00:00Z")), 2451545.0));
test("Meeus Moon 1992-04-12 (133.167)", () => assert.ok(diff(C.tropicalLongitudes(2448724.5).Moon, 133.167) < 0.15));
test("Meeus Venus 1992-12-20 (313.081)", () => assert.ok(diff(C.tropicalLongitudes(2448976.5).Venus, 313.081) < 0.05));
test("Sun/Moon at J2000", () => { const t = C.tropicalLongitudes(2451545.0); assert.ok(diff(t.Sun,280.37)<0.05); assert.ok(diff(t.Moon,223.32)<0.1); });
for (const c of fx) test(`parity with Python reference ${c.utc}`, () => {
  const ch = C.computeChart(new Date(c.utc), c.lat, c.lon);
  assert.ok(Math.abs(ch.settings.ayanamsha_value_deg - c.ayanamsha) < 1e-3);
  assert.equal(ch.lagna.sign, c.lagna.sign); assert.ok(Math.abs(ch.lagna.degree - c.lagna.degree) < 1e-3);
  for (const [p,v] of Object.entries(c.planets)) {
    const j = ch.planets[p]; assert.ok(diff(j.longitude, v.longitude) < 1e-3, `${p} longitude`);
    assert.equal(j.sign, v.sign); assert.equal(j.house, v.house); assert.equal(j.nakshatra, v.nakshatra); assert.equal(j.pada, v.pada);
    assert.equal(j.retrograde, v.retrograde, `${p} retro`); assert.equal(j.dignity, v.dignity); if ("combust" in v) assert.equal(j.combust, v.combust);
  }
  for (const [p,h] of Object.entries(c.aspects)) assert.deepEqual(ch.aspects[p].aspect_houses, h);
});
test("regression: 1947 chart signs", () => { const ch = C.computeChart(new Date("1947-08-14T18:30:00Z"), 28.6139, 77.2090);
  assert.equal(ch.lagna.sign,"Taurus"); assert.equal(ch.planets.Moon.nakshatra,"Pushya"); assert.equal(ch.planets.Jupiter.sign,"Libra"); assert.equal(ch.settings.ephemeris_verified,false); });
test("Mercury retrograde 2020-07-01", () => { const ch = C.computeChart(new Date("2020-07-01T06:00:00Z"),28.6,77.2); assert.ok(ch.planets.Mercury.retrograde); assert.ok(!ch.planets.Sun.retrograde); });

test("time: IST 1947 and AM/PM", () => {
  assert.equal(C.localToUtc(1947,8,15,12,0,"AM","Asia/Kolkata").toISOString(), "1947-08-14T18:30:00.000Z");
  assert.equal(C.localToUtc(1990,1,1,12,0,"AM","UTC").getUTCHours(), 0); assert.equal(C.localToUtc(1990,1,1,12,30,"PM","UTC").getUTCHours(), 12);
  assert.equal(C.localToUtc(1990,1,1,10,30,"PM","UTC").getUTCHours(), 22);
});
test("time: DST overlap and gap rejected", () => {
  assert.throws(() => C.localToUtc(2023,11,5,1,30,"AM","America/New_York"), C.AmbiguousTime);
  assert.throws(() => C.localToUtc(2023,3,12,2,30,"AM","America/New_York"), C.AmbiguousTime);
  assert.equal(C.localToUtc(2023,7,1,9,0,"AM","America/New_York").toISOString(), "2023-07-01T13:00:00.000Z");
});
test("time: invalid inputs", () => {
  for (const a of [[1990,1,1,13,0,"AM","UTC"],[1990,1,1,5,60,"AM","UTC"],[1990,1,1,5,0,"XM","UTC"],[1990,2,30,5,0,"AM","UTC"],[1990,1,1,5,0,"AM","Nowhere/City"]])
    assert.throws(() => C.localToUtc(...a), C.ChartError);
});
test("places", () => {
  assert.equal(resolvePlace("Bhopal").tz, "Asia/Kolkata"); assert.equal(resolvePlace("26.85, 80.95, Asia/Kolkata").lat, 26.85);
  assert.equal(resolvePlace("Atlantis"), null); assert.equal(resolvePlace("1,2,Bad/Zone"), null); assert.equal(resolvePlace("99,2,UTC"), null); assert.equal(resolvePlace("__proto__"), null);
});
test("houses, lords, aspects, dignity, combustion (injected longitudes)", () => {
  const sid = Object.fromEntries(C.PLANETS.map(p => [p,0])); Object.assign(sid,{Sun:15,Moon:100,Mars:10,Mercury:20,Jupiter:130,Venus:250,Saturn:300,Rahu:40,Ketu:220});
  const ch = C.analyze(sid, 5);
  assert.equal(ch.lagna.lord,"Mars"); assert.equal(ch.lagna.lord_house,1); assert.equal(ch.houses[3].lord,"Moon"); assert.equal(ch.planets.Moon.house,4); assert.equal(ch.planets.Saturn.house,11);
  assert.deepEqual(ch.aspects.Mars.aspect_houses,[4,7,8]); assert.deepEqual(ch.aspects.Jupiter.aspect_houses,[9,11,1]); assert.deepEqual(ch.aspects.Saturn.aspect_houses,[1,5,8]);
  assert.ok(ch.aspects.Mars.aspected_planets.includes("Moon")); assert.equal(ch.planets.Sun.dignity,"exalted"); assert.equal(ch.planets.Moon.dignity,"own sign");
  assert.ok(ch.planets.Mercury.combust); assert.ok(!ch.planets.Venus.combust);
  const m = Object.fromEntries(C.PLANETS.map(p => [p,0])); m.Moon = 13.34; assert.deepEqual([C.analyze(m,0).planets.Moon.nakshatra, C.analyze(m,0).planets.Moon.pada], ["Bharani",1]);
});
test("D1 only; bad inputs", () => {
  for (const c of ["D9","Chandra","Arudha"]) assert.throws(() => C.computeChart(new Date("2000-01-01T00:00:00Z"),20,77,{},c), C.ChartError);
  assert.equal(C.computeChart(new Date("2000-01-01T00:00:00Z"),20,77).chart,"D1");
  assert.throws(() => C.computeChart(new Date("2000-01-01T00:00:00Z"),20,77,{ayanamsha:"xyz"}), C.ChartError);
  assert.throws(() => C.computeChart(new Date("2000-01-01T00:00:00Z"),80,20), C.ChartError);
  assert.throws(() => C.computeChart(new Date("2000-01-01T00:00:00Z"),20,200), C.ChartError);
});
