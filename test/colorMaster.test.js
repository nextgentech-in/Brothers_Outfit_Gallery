import {
  searchColors,
  normalizeToStandardColor,
  DEFAULT_COLOR_MASTER
} from '../src/data/colorMaster.js';
import { findNearestStandardColor } from '../src/utils/imageColorDetector.js';

console.log('--- RUNNING COLOR SELECTION VERIFICATION TESTS ---');

// Test 1: Black shirt -> Nearest is Black
const blackTest = findNearestStandardColor('#111111');
console.log('1. Black test (#111111):', blackTest.standardColor.name, '(Expected: Black)', 'Confidence:', blackTest.confidence + '%');
if (blackTest.standardColor.name !== 'Black') throw new Error('Test 1 Failed');

// Test 2: Rani-colored (#C41242 or #C91647) -> Suggest Rani
const raniTest = findNearestStandardColor('#C91647');
console.log('2. Rani test (#C91647):', raniTest.standardColor.name, '(Expected: Rani)', 'Confidence:', raniTest.confidence + '%');
if (raniTest.standardColor.name !== 'Rani') throw new Error('Test 2 Failed');

// Test 3: Navy Blue (#1E293B or #1A2744) -> Suggest Navy Blue
const navyTest = findNearestStandardColor('#1A2744');
console.log('3. Navy Blue test (#1A2744):', navyTest.standardColor.name, '(Expected: Navy Blue)', 'Confidence:', navyTest.confidence + '%');
if (navyTest.standardColor.name !== 'Navy Blue') throw new Error('Test 3 Failed');

// Test 4: White product (#F8FAFC) -> Suggest White
const whiteTest = findNearestStandardColor('#F8FAFC');
console.log('4. White test (#F8FAFC):', whiteTest.standardColor.name, '(Expected: White)', 'Confidence:', whiteTest.confidence + '%');
if (whiteTest.standardColor.name !== 'White') throw new Error('Test 4 Failed');

// Test 7: Search "rani pink" -> Find Rani
const searchRaniPink = searchColors('rani pink');
console.log('7. Search "rani pink":', searchRaniPink.map(c => c.name));
if (!searchRaniPink.some(c => c.name === 'Rani')) throw new Error('Test 7 Failed');

// Test 8: Search "rani" -> Find Rani
const searchRani = searchColors('rani');
console.log('8. Search "rani":', searchRani.map(c => c.name));
if (!searchRani.some(c => c.name === 'Rani')) throw new Error('Test 8 Failed');

// Test Search "pink" -> Finds Rani and Pink
const searchPink = searchColors('pink');
console.log('Search "pink":', searchPink.map(c => c.name));
if (!searchPink.some(c => c.name === 'Rani') || !searchPink.some(c => c.name === 'Pink')) throw new Error('Search pink failed');

// Test 10: Existing products with old color names normalization
const normRani = normalizeToStandardColor('rani pink');
console.log('10a. Normalize "rani pink":', normRani);
if (normRani.name !== 'Rani' || normRani.hex !== '#C41242') throw new Error('Normalization of rani pink failed');

const normNavy = normalizeToStandardColor('dark blue');
console.log('10b. Normalize "dark blue":', normNavy);
if (normNavy.name !== 'Navy Blue') throw new Error('Normalization of dark blue failed');

const normBlackObj = normalizeToStandardColor({ name: 'Black' });
console.log('10c. Normalize { name: "Black" }:', normBlackObj);
if (normBlackObj.name !== 'Black' || normBlackObj.id !== 'black') throw new Error('Normalization of Black obj failed');

console.log('ALL TESTS PASSED SUCCESSFULLY! ✅');
