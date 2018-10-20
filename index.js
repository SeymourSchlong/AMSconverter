/* ~~ mss to txt converter by seymour#3669*/

'use strict';

const fs = require('fs'); // File System
const notes = require('./notes.json'); // All note conversions
const convert = require('xml-js'); // Converts XML files to a js-compatible version

const xmlFiles = fs.readdirSync('./input').filter(file => file.endsWith('.mss')); // Imports all XML files that end with .mss (AMS format)

// Writes data to a .txt file found in ./output
function writeTXT(fileName, data) {
    fs.writeFileSync(`./output/${fileName}.txt`, data);
    console.log(`Successfully converted file ${fileName}.mss to ${fileName}.txt`);
}

// For every XML file...
for (const file of xmlFiles) {
    // Write JSON files
    const data = fs.readFileSync(`./input/${file}`);
    const xmlFile = convert.xml2json(data, {compact:false, spaces: 4});
    fs.writeFileSync('./temp/' + file.replace('.mss', '.json'), xmlFile);

    const songName = file.replace('.mss', '');

    // Read JSON files and convert data to a SMP compatible version
    const fileData = JSON.parse(fs.readFileSync(`./temp/${songName}.json`, 'utf8'));

    const songInfo = fileData.elements[0];

    let tempo = songInfo.attributes.tempo;
    let ext = 0;
    let timeSig = 4;
    let soundfont = songInfo.attributes.soundfont;

    const txtHeader = `TEMPO: ${tempo}.000000, EXT: ${ext}, TIME: ${timeSig}/4, SOUNDSET: ${soundfont ==  'MarioPaintOriginal' ? '' : soundfont}`;
    
    let fileText = txtHeader;

    let barNum = 1;
    let lineNum = -1;
    let runThrough = -1;

    for (let i = 0; i < fileData.elements[0].elements.length; i++) { // For every line in the song...
        const line = fileData.elements[0].elements[i];

        runThrough++;
        if (runThrough == 4) {
            barNum++;
            runThrough = 0;
        }
        lineNum++;
        if (lineNum >= 4) lineNum = 0;

        let lineVol = line.attributes.volume * 8;

        const lineData = `\n${barNum}:${lineNum},NOTESVOL: ${lineVol}`;

        if (line.elements != undefined) {
            let lineNotes = '';

            for (let note of line.elements) { // For every note in the line
                let inst = note.name;
                let value = note.elements[0].text;
                let tempNOTES = value.split('');
                let newNOTES = [];

                for (let a = 0; a < tempNOTES.length; a++) { // Putting each note into an array and joining flats and sharps to a note
                    if (tempNOTES[a] == '+') {
                        newNOTES.push(tempNOTES[a] + tempNOTES[a+1]);
                        a++;
                    } else if (tempNOTES[a] == '-') {
                        newNOTES.push(tempNOTES[a] + tempNOTES[a+1]);
                        a++;
                    } else if (tempNOTES[a] != '+' || tempNOTES[a] != '-') {
                        newNOTES.push(tempNOTES[a]);
                    }
                }

                for (let b = 0; b < newNOTES.length; b++) {

                    let instNote = notes[newNOTES[b]];
                    
                    if (inst.startsWith('x')) { // Instrument muting
                        inst = inst.substr(1);
                        instNote += 'm1';
                    }

                    lineNotes += `${inst.toUpperCase()} ${instNote},`;
                }

            }
            
            fileText += lineData.replace('NOTES', lineNotes);
        }

    }

    // Write the songData to TXT file
    writeTXT(songName, fileText);
}

// require2s the JSON files in ./temp
const jsonFiles = fs.readdirSync('./temp').filter(file => file.endsWith('.json'));
for (const json of jsonFiles) {
    
}

// Clean up JSON files
for (const file of jsonFiles) {
    fs.unlinkSync(`./temp/${file}`);
}