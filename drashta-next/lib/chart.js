// Deterministic D1 (Rashi/Lagna) chart engine. No language model involved.
// EPHEMERIS STATUS: APPROXIMATE / NOT SWISS EPHEMERIS. Port of a low-precision analytic model
// (Schlyter-style orbital elements + main Moon/Jupiter/Saturn perturbations).
// Typical error: Sun ~0.02 deg, planets ~0.02-0.1 deg, Moon ~0.1-0.3 deg; geocentric, no parallax.
// Sign/house are usually right; nakshatra/pada and sign-edge cases can be wrong. Replace
// tropicalLongitudes() with a Swiss Ephemeris/JPL provider for authoritative results.
export const SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
export const LORDS = ["Mars","Venus","Mercury","Moon","Sun","Mercury","Venus","Mars","Jupiter","Saturn","Saturn","Jupiter"];
export const NAKS = ["Ashwini","Bharani","Krittika","Rohini","Mrigashira","Ardra","Punarvasu","Pushya","Ashlesha","Magha","Purva Phalguni","Uttara Phalguni","Hasta","Chitra","Swati","Vishakha","Anuradha","Jyeshtha","Mula","Purva Ashadha","Uttara Ashadha","Shravana","Dhanishta","Shatabhisha","Purva Bhadrapada","Uttara Bhadrapada","Revati"];
export const PLANETS = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn","Rahu","Ketu"];
const EXALT = {Sun:0,Moon:1,Mars:9,Mercury:5,Jupiter:3,Venus:11,Saturn:6};
const OWN = {Sun:[4],Moon:[3],Mars:[0,7],Mercury:[2,5],Jupiter:[8,11],Venus:[1,6],Saturn:[9,10]};
const ASPECTS = {Sun:[7],Moon:[7],Mars:[4,7,8],Mercury:[7],Jupiter:[5,7,9],Venus:[7],Saturn:[3,7,10],Rahu:[7],Ketu:[7]};
export const DEFAULT_SETTINGS = {ayanamsha:"lahiri",
  combustion_orbs:{Moon:12,Mars:17,Mercury:14,Jupiter:11,Venus:10,Saturn:15}, combustion_orbs_retro:{Mercury:12,Venus:8}};
export class ChartError extends Error {}
export class AmbiguousTime extends ChartError {}

const rad = x => x*Math.PI/180, deg = x => x*180/Math.PI, mod = (x,n) => ((x%n)+n)%n;

export function jdFromDate(d) {
  let y = d.getUTCFullYear(), m = d.getUTCMonth()+1;
  const D = d.getUTCDate() + (d.getUTCHours() + (d.getUTCMinutes() + d.getUTCSeconds()/60)/60)/24;
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y/100), B = 2 - A + Math.floor(A/4);
  return Math.floor(365.25*(y+4716)) + Math.floor(30.6001*(m+1)) + D + B - 1524.5;
}
function kepler(M, e) {
  M = rad(mod(M,360)); let E = M + e*Math.sin(M)*(1+e*Math.cos(M));
  for (let i=0;i<30;i++){ const dE=(E-e*Math.sin(E)-M)/(1-e*Math.cos(E)); E-=dE; if(Math.abs(dE)<1e-12)break; }
  return E;
}
function sun(d) {
  const w=282.9404+4.70935e-5*d, e=0.016709-1.151e-9*d, M=356.0470+0.9856002585*d, E=kepler(M,e);
  const xv=Math.cos(E)-e, yv=Math.sqrt(1-e*e)*Math.sin(E), lon=deg(Math.atan2(yv,xv))+w, r=Math.hypot(xv,yv);
  return {x:r*Math.cos(rad(lon)), y:r*Math.sin(rad(lon)), lon:mod(lon,360), M, w};
}
function moon(d, Ms, ws) {
  const N=125.1228-0.0529538083*d, i=5.1454, w=318.0634+0.1643573223*d, a=60.2666, e=0.0549, M=115.3654+13.0649929509*d;
  const E=kepler(M,e), xv=a*(Math.cos(E)-e), yv=a*Math.sqrt(1-e*e)*Math.sin(E), u=rad(deg(Math.atan2(yv,xv))+w);
  const x=Math.cos(rad(N))*Math.cos(u)-Math.sin(rad(N))*Math.sin(u)*Math.cos(rad(i));
  const y=Math.sin(rad(N))*Math.cos(u)+Math.cos(rad(N))*Math.sin(u)*Math.cos(rad(i));
  let lon=deg(Math.atan2(y,x)); const Lm=N+w+M, Ls=ws+Ms, D=Lm-Ls, F=M+w, s=a_=>Math.sin(rad(a_));
  lon += -1.274*s(M-2*D)+0.658*s(2*D)-0.186*s(Ms)-0.059*s(2*M-2*D)-0.057*s(M-2*D+Ms)+0.053*s(M+2*D)+0.046*s(2*D-Ms)+0.041*s(M-Ms)-0.035*s(D)-0.031*s(M+Ms)-0.015*s(2*F-2*D)+0.011*s(M-4*D);
  return mod(lon,360);
}
const EL = { // N0,N1,i0,i1,w0,w1,a,e0,e1,M0,M1
  Mercury:[48.3313,3.24587e-5,7.0047,5.00e-8,29.1241,1.01444e-5,0.387098,0.205635,5.59e-10,168.6562,4.0923344368],
  Venus:[76.6799,2.46590e-5,3.3946,2.75e-8,54.8910,1.38374e-5,0.723330,0.006773,-1.302e-9,48.0052,1.6021302244],
  Mars:[49.5574,2.11081e-5,1.8497,-1.78e-8,286.5016,2.92961e-5,1.523688,0.093405,2.516e-9,18.6021,0.5240207766],
  Jupiter:[100.4542,2.76854e-5,1.3030,-1.557e-7,273.8777,1.64505e-5,5.20256,0.048498,4.469e-9,19.8950,0.0830853001],
  Saturn:[113.6634,2.38980e-5,2.4886,-1.081e-7,339.3939,2.97661e-5,9.55475,0.055546,-9.499e-9,316.9670,0.0334442282]};
function planet(name, d, xs, ys) {
  const [N0,N1,i0,i1,w0,w1,a,e0,e1,M0,M1]=EL[name];
  const N=N0+N1*d, i=i0+i1*d, w=w0+w1*d, e=e0+e1*d, M=M0+M1*d, E=kepler(M,e);
  const xv=a*(Math.cos(E)-e), yv=a*Math.sqrt(1-e*e)*Math.sin(E), v=deg(Math.atan2(yv,xv)), r=Math.hypot(xv,yv), u=rad(v+w);
  let xh=r*(Math.cos(rad(N))*Math.cos(u)-Math.sin(rad(N))*Math.sin(u)*Math.cos(rad(i)));
  let yh=r*(Math.sin(rad(N))*Math.cos(u)+Math.cos(rad(N))*Math.sin(u)*Math.cos(rad(i)));
  const zh=r*Math.sin(u)*Math.sin(rad(i));
  if (name==="Jupiter"||name==="Saturn") {
    const Mj=19.8950+0.0830853001*d, Ms=316.9670+0.0334442282*d, s=a_=>Math.sin(rad(a_)), c=a_=>Math.cos(rad(a_));
    let lon=deg(Math.atan2(yh,xh)); const lat=Math.atan2(zh,Math.hypot(xh,yh));
    lon += name==="Jupiter"
      ? -0.332*s(2*Mj-5*Ms-67.6)-0.056*s(2*Mj-2*Ms+21)+0.042*s(3*Mj-5*Ms+21)-0.036*s(Mj-2*Ms)+0.022*c(Mj-Ms)+0.023*s(2*Mj-3*Ms+52)-0.016*s(Mj-5*Ms-69)
      : 0.812*s(2*Mj-5*Ms-67.6)-0.229*c(2*Mj-4*Ms-2)+0.119*s(Mj-2*Ms-3)+0.046*s(2*Mj-6*Ms-69)+0.014*s(Mj-3*Ms+32);
    const rr=Math.hypot(Math.hypot(xh,yh),zh);
    xh=rr*Math.cos(lat)*Math.cos(rad(lon)); yh=rr*Math.cos(lat)*Math.sin(rad(lon));
  }
  return mod(deg(Math.atan2(yh+ys,xh+xs)),360);
}
export function tropicalLongitudes(jd) {
  const d=jd-2451543.5, s=sun(d), out={Sun:s.lon, Moon:moon(d,s.M,s.w)};
  for (const n of ["Mercury","Venus","Mars","Jupiter","Saturn"]) out[n]=planet(n,d,s.x,s.y);
  const T=(jd-2451545.0)/36525, om=mod(125.0445479-1934.1362891*T+0.0020754*T*T,360);
  out.Rahu=om; out.Ketu=mod(om+180,360); return out;
}
export function ayanamshaDeg(jd, name="lahiri") {
  const prec = 1.396971*(jd-2451545.0)/36525;
  if (name==="lahiri") return 23.8531+prec;
  if (name.startsWith("custom:")) { const v=Number(name.slice(7)); if(!Number.isFinite(v)) throw new ChartError("Invalid custom ayanamsha"); return v+prec; }
  throw new ChartError(`Unsupported ayanamsha: ${name} (supported: lahiri, custom:<deg at J2000>)`);
}
export function ascendantTropical(jd, lat, lon) {
  const T=(jd-2451545.0)/36525, ramc=mod(280.46061837+360.98564736629*(jd-2451545.0)+0.000387933*T*T+lon,360), eps=rad(23.4392911-0.0130042*T);
  return mod(deg(Math.atan2(Math.cos(rad(ramc)), -(Math.sin(rad(ramc))*Math.cos(eps)+Math.tan(rad(lat))*Math.sin(eps)))),360);
}
// ---- timezone-safe local -> UTC (historical rules via ICU; DST gaps/overlaps rejected) ----
function offsetMs(tz, ms) {
  const f = new Intl.DateTimeFormat("en-US",{timeZone:tz,hourCycle:"h23",year:"numeric",month:"numeric",day:"numeric",hour:"numeric",minute:"numeric",second:"numeric"});
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map(x=>[x.type,x.value]));
  return Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second) - Math.floor(ms/1000)*1000;
}
export function localToUtc(year, month, day, hour12, minute, ampm, tz) {
  if (!Number.isInteger(hour12)||hour12<1||hour12>12) throw new ChartError("Hour must be 1-12 (with AM/PM).");
  if (!Number.isInteger(minute)||minute<0||minute>59) throw new ChartError("Minute must be 0-59.");
  ampm = String(ampm).toUpperCase(); if (ampm!=="AM"&&ampm!=="PM") throw new ChartError("Please specify AM or PM.");
  const h = hour12%12 + (ampm==="PM"?12:0), wall = Date.UTC(year,month-1,day,h,minute);
  const chk = new Date(wall); if (chk.getUTCFullYear()!==year||chk.getUTCMonth()!==month-1||chk.getUTCDate()!==day) throw new ChartError("Invalid calendar date.");
  let o1, o2;
  try { o1=offsetMs(tz,wall-864e5); o2=offsetMs(tz,wall+864e5); } catch { throw new ChartError(`Unknown timezone: ${tz}`); }
  const cands = [...new Set([wall-o1, wall-o2])].filter(c => offsetMs(tz,c) === wall-c);
  if (cands.length !== 1) throw new AmbiguousTime(`That local time is ambiguous or non-existent in ${tz} because of a daylight-saving change. Please give the correct local time or UTC offset.`);
  return new Date(cands[0]);
}
const dms = x => `${Math.floor(x)}\u00b0${String(Math.floor((x%1)*60)).padStart(2,"0")}\u2032`;
const r4 = x => Math.round(x*1e4)/1e4;
export function analyze(sid, lagnaSid, speeds=null, settings={}) {
  const st = {...DEFAULT_SETTINGS, ...settings}, li = Math.floor(lagnaSid/30), planets = {};
  for (const p of PLANETS) {
    const L=mod(sid[p],360), si=Math.floor(L/30), nk=Math.floor(L/(40/3)), pada=Math.floor((L%(40/3))/(10/3))+1;
    const retro = p==="Rahu"||p==="Ketu"||(speeds!==null&&p!=="Sun"&&p!=="Moon"&&speeds[p]<0);
    planets[p] = {longitude:r4(L), sign:SIGNS[si], degree:r4(L%30), dms:dms(L%30), house:mod(si-li,12)+1, nakshatra:NAKS[nk], pada, lord_of_sign:LORDS[si], retrograde:!!retro,
      dignity: p in EXALT ? (si===EXALT[p]?"exalted":si===(EXALT[p]+6)%12?"debilitated":OWN[p].includes(si)?"own sign":"neutral (friend/enemy not computed)") : "not assessed"};
  }
  for (const [p,orb] of Object.entries(st.combustion_orbs)) {
    const o = planets[p].retrograde && st.combustion_orbs_retro[p] ? st.combustion_orbs_retro[p] : orb;
    const diff = Math.abs(mod(sid[p]-sid.Sun+180,360)-180);
    planets[p].combust = diff<o; planets[p].sun_distance = Math.round(diff*100)/100;
  }
  const houses = Array.from({length:12},(_,k)=>{ const si=(li+k)%12; return {house:k+1, sign:SIGNS[si], lord:LORDS[si], planets:PLANETS.filter(p=>planets[p].house===k+1)}; });
  const aspects = {};
  for (const p of PLANETS) { const hs=ASPECTS[p].map(n=>(planets[p].house+n-2)%12+1);
    aspects[p]={aspect_houses:hs, aspected_planets:PLANETS.filter(q=>q!==p&&hs.includes(planets[q].house))}; }
  const L=mod(lagnaSid,360), lord=LORDS[li];
  return {chart:"D1", lagna:{sign:SIGNS[li], degree:r4(L%30), dms:dms(L%30), lord, lord_house:planets[lord].house, nakshatra:NAKS[Math.floor(L/(40/3))], pada:Math.floor((L%(40/3))/(10/3))+1}, houses, planets, aspects};
}
export function computeChart(utc, lat, lon, settings={}, chart="D1") {
  if (chart!=="D1") throw new ChartError("Only the D1 (Lagna) chart is supported.");
  const st={...DEFAULT_SETTINGS,...settings};
  if (!(lat>=-90&&lat<=90&&lon>=-180&&lon<=180)) throw new ChartError("Latitude/longitude out of range.");
  if (Math.abs(lat)>66) throw new ChartError("Ascendant is unreliable at polar latitudes; chart refused.");
  const jd=jdFromDate(utc), ay=ayanamshaDeg(jd,st.ayanamsha), trop=tropicalLongitudes(jd), a2=tropicalLongitudes(jd+0.5), a1=tropicalLongitudes(jd-0.5);
  const sid={}, speeds={}; for (const p of PLANETS) { sid[p]=mod(trop[p]-ay,360); speeds[p]=mod(a2[p]-a1[p]+180,360)-180; }
  const out = analyze(sid, mod(ascendantTropical(jd,lat,lon)-ay,360), speeds, st);
  out.settings = {ephemeris:"built-in analytic model - APPROXIMATE, not Swiss Ephemeris (see lib/chart.js)", ephemeris_verified:false, zodiac:"sidereal",
    ayanamsha:st.ayanamsha, ayanamsha_value_deg:r4(ay), node:"mean Rahu/Ketu (geocentric)", house_system:"whole-sign houses from Lagna sign",
    aspects:"Parashari graha drishti convention (7th for all; Mars 4/8, Jupiter 5/9, Saturn 3/10; Rahu/Ketu 7th only) - external convention, not verified against supplied BPHS",
    combustion_orbs_deg:st.combustion_orbs, utc:utc.toISOString(), julian_day_ut:Math.round(jd*1e5)/1e5, lat, lon};
  return out;
}
export function timeSensitivity(utc, lat, lon, minutes=30, settings={}) {
  const base=computeChart(utc,lat,lon,settings), res=[-minutes,minutes].map(m=>{ const c=computeChart(new Date(utc.getTime()+m*60000),lat,lon,settings); return [c.lagna.sign,c.planets.Moon.nakshatra]; });
  return {window_minutes:minutes, lagna_may_change:res.some(x=>x[0]!==base.lagna.sign), moon_nakshatra_may_change:res.some(x=>x[1]!==base.planets.Moon.nakshatra)};
}
