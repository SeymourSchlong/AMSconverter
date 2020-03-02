'use strict';

const fs = require('fs');               // File System
const Notes = require('./notes.json');  // All note conversions
const convert = require('xml-js');      // Converts XML files to a js-compatible version
const shell = require('shelljs');       // Can create directories

// Import all MSS files (AMS format)
const xmlFiles = fs.readdirSync('./input').filter(file => file.endsWith('.mss')); 

// AMS instrument names and their SMP counterparts
const amsNames = ['toad','plant','ghost'];
const smpNames = ['mushroom','piranha','boo'];

let testing = false;
let currentFileName = '';

// Catches any errors
try {
    // Make the "output" and "temp" folders if they doesn't exist
    shell.mkdir('-p', './output');
    shell.mkdir('-p', './temp');

    // Write file data to an JSON file
    const xmlWrite = (fileName) => {
        currentFileName = fileName;
        const data = fs.readFileSync(`./input/${fileName}.mss`);                // Read XML data
        const xmlFile = convert.xml2json(data, {compact: false, spaces: 4});    // Convert XML data to JSON
        fs.writeFileSync(`./temp/${fileName}.json`, xmlFile);                   // Save JSON file in "temp" folder
    }

    const txtWrite = (fileName, data, num, type) => {
        fs.writeFileSync(`./output/${fileName}/${type === 'arr' ? 'ARR ' : ''}${type === 'song' ? `${fileName}${num ? ' ' + num : ''}` : fileName}.txt`, data);
    }

    // For every XML file in the "input" folder...
    for (const file of xmlFiles) {
        const songName = file.slice(0, -4);                                                 // songName is the file's name, but the extension is removed
        xmlWrite(songName);                                                                 // Converts the XML file's data to JSON
        const fileData = JSON.parse(fs.readFileSync(`./temp/${songName}.json`, 'utf8'));    // Reads the JSON file data
        shell.mkdir('-p', `./output/${songName}`);                                         // Creates a folder for the song when it's complete

        let songParts = [];
        let songInfo = fileData.elements[0];

        let startingTempo = songInfo.attributes.tempo;
        let soundfont = songInfo.attributes.soundfont;
        if (soundfont === "MarioPaintOriginal") soundfont = "";
        else if (soundfont === "|custom|") soundfont = songName + ".sf2";
        else soundfont = soundfont + ".sf2";
        let lineData = songInfo.elements;

        let partInfo = {};
        partInfo.tempo = startingTempo;
        partInfo.noteData = [];

        let barNum = 1;
        let beatNum = -1;

        for (let i = 0; i < lineData.length; i++) {

            let line = lineData[i];
            
            if (line.name !== "channelconfig") {
                beatNum++;
                if (beatNum === 4) {
                    beatNum = 0;
                    barNum++;
                }

                let speedmarkPresent = false, speedmarkTempo;
                
                if (line.elements) {
                    let beatVol = line.attributes.volume*8;

                    let lineInfo = {
                        vol: beatVol,
                        bar: barNum,
                        beat: beatNum,
                        notes: []
                    };

                    /*
                    line.elements.forEach(note => {
                        if (note.name === "speedmark") {
                            songParts.push(partInfo);
                            partInfo = {};
                            partInfo.tempo = note.attributes.tempo;
                            partInfo.noteData = [];
                            barNum = 1;
                            beatNum = -1;
                        }
                    });/**/
                    for (let note of line.elements) {
                        let instName = note.name;
                        if (["bookmark", "speedmark"].indexOf(instName) === -1) {
                            let noteVal = note.elements[0].text;
                            let notes = noteVal.replace(/([+\-]?\w)/g, '$1 ').split(' ');
                            notes.pop();

                            notes.forEach(note => {
                                note = Notes[note];
                                if (instName.startsWith('x')) {
                                    note += 'm1';
                                    instName = instName.replace('x', '');
                                }
                                if (amsNames.indexOf(instName) !== -1) {
                                    instName = smpNames[amsNames.indexOf(instName)];
                                }
                                lineInfo.notes.push({ inst: instName.toUpperCase(), val: note });
                            });
                        } else if (instName === "speedmark") {
                            speedmarkPresent = true;
                            speedmarkTempo = note.attributes.tempo;
                        }
                    }

                    partInfo.noteData.push(lineInfo);
                }
                    
                if (speedmarkPresent) {
                    songParts.push(partInfo);
                    partInfo = {};
                    partInfo.tempo = speedmarkTempo;
                    partInfo.noteData = [];
                    barNum = 1;
                    beatNum = -1;
                }
            }
        }

        songParts.push(partInfo);

        let arrTxt = '';

        for (let i = 0; i < songParts.length; i++) {
            arrTxt += `${songName} ${i + 1}\r\n`;
            let part = songParts[i];
            let songHeader = `TEMPO: ${part.tempo}.000000, EXT: 0, TIME: 4/4, SOUNDSET: ${soundfont}`;
            let songData = '';
            for (let line of part.noteData) {
                let vol = line.vol;
                let bar = line.bar;
                let beat = line.beat;
                songData += `\r\n${bar}:${beat},`;
                line.notes.forEach(note => {
                    songData += `${note.inst} ${note.val},`;
                });
                songData += `VOL: ${vol}`;
            }
            
            let songTxt = songHeader + songData;
            txtWrite(songName, songTxt, (songParts.length === 1 ? null : i + 1), 'song');
        }

        if (songParts.length > 1) {
            txtWrite(songName, arrTxt, 0, 'arr');
        }

        console.log(`Converted file: ${file}`)

        // Deletes the JSON file from the "temp" folder
        if (!testing) fs.unlinkSync(`./temp/${songName}.json`);
    }
} catch(err) {
    // Log the error
    console.error(err);

    // Make the errorlog directory if it doesn't exist (it should never exist without an error)
    shell.mkdir('-p', './errorlog');

    // Setting the name for the file
    const date = new Date(Date.now());
    const errName = `${date.getFullYear()}.${date.getMonth()+1}.${date.getDate()}.${date.getHours()}.${date.getMinutes()}`;

    fs.writeFileSync(`./errorlog/${errName}.txt`, err + `\r\n\r\nAn error has occurred with the file: ${currentFileName}.mss. Please send "seymour schlong#3669" this file, as well as ${currentFileName}.json file in the "temp" folder.`);
}

// Remove the "temp" directory (only if there are no errors)
if (!testing) fs.rmdirSync('./temp');
