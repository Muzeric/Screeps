var utils = require('utils');
const profiler = require('screeps-profiler');

var stat = {
    lastCPU : 0,

    init : function () {
        Memory.stat = Memory.stat || {};
        Memory.stat.CPUHistory = Memory.stat.CPUHistory || {};
        Memory.stat.roomHistory = Memory.stat.roomHistory || {};
        Memory.stat.lastGcl =  Memory.stat.lastGcl || _.floor(Game.gcl.progress/1000);
        Memory.stat.roomSent = Memory.stat.roomSent || Game.time;
        this.lastCPU = 0;
    },

    addRoom : function (roomName) {
        Memory.stat.roomHistory[roomName] = Memory.stat.roomHistory[roomName] || {harvest: 0, create: 0, build: 0, repair: 0, upgrade: 0, pickup: 0, cpu: 0};
    },

    updateRoom : function (roomName, param, diff) {
        this.addRoom(roomName);
        Memory.stat.roomHistory[roomName][param] = (Memory.stat.roomHistory[roomName][param] || 0) + diff;
    },

    addCPU : function (marker, info) {
        if(!Memory.stat.CPUHistory[marker])
            Memory.stat.CPUHistory[marker] = {cpu: 0};
        let mem = Memory.stat.CPUHistory[marker];

        mem.cpu += Game.cpu.getUsed() - this.lastCPU;
        
        if (info) {
            if(!mem.info)
                mem.info = {};
            for (let key in info) {
                if (!mem.info[key])
                    mem.info[key] = {};
                let imem = mem.info[key];
                for (let ikey in info[key]) {
                    imem[ikey] = (imem[ikey] || 0) + info[key][ikey];
                }
            }
        }
        this.lastCPU = Game.cpu.getUsed();
    },

    finish : function () {
        if(!Memory.stat.CPUHistory["_total"])
            Memory.stat.CPUHistory["_total"] = {cpu: 0, count: 0};
        
        Memory.stat.CPUHistory["_total"].cpu += Game.cpu.getUsed();
        Memory.stat.CPUHistory["_total"].count++;
        if (Memory.stat.CPUHistory["_total"].count >= 100) {
            Memory.stat.CPUHistory["_total"].bucket = Game.cpu.bucket;
            Memory.stat.CPUHistory["_total"].creeps = _.keys(Game.creeps).length;
            Memory.stat.CPUHistory["_total"].energy = _.sum(_.filter(Memory.rooms, r => r.type == 'my'), r => r.energy);
            Memory.stat.CPUHistory["_total"].gcl = _.floor(Game.gcl.progress/1000 - Memory.stat.lastGcl);
            Memory.stat.CPUHistory["_total"].paths = _.sum(Memory.rooms, r => r.pathCount || 0);
            Game.notify(
                "CPUHistory:" + Game.time + ":" + 
                utils.lzw_encode(JSON.stringify(Memory.stat.CPUHistory, function(key, value) {return typeof value == 'number' ? _.floor(value,1) : value;} )) +
                "#END#"
            );
            delete Memory.stat.CPUHistory;
            Memory.stat.lastGcl = _.floor(Game.gcl.progress/1000);
        }

        if (Game.time - Memory.stat.roomSent > 100) {
            Game.notify(
                "roomHistory:" + Game.time + ":" + 
                utils.lzw_encode(JSON.stringify(Memory.stat.roomHistory, function(key, value) {return typeof value == 'number' ? _.floor(value,1) : value;} )) +
                "#END#"
            );
            delete Memory.stat.roomHistory;
            Memory.stat.roomSent = Game.time;
        }
    },

    die : function (name) {
        let creepm = Memory.creeps[name];
        if(!Memory.stat[creepm.role])
            Memory.stat[creepm.role] = {};
        if(!Memory.stat[creepm.role][creepm.energy])
            Memory.stat[creepm.role][creepm.energy] = {};
        
        let statm = Memory.stat[creepm.role][creepm.energy];
        for (let statName in creepm.stat) {
                statm['avg' + statName] = statm['avg' + statName] ? statm['avg' + statName]*0.9 + creepm.stat[statName]*0.1 : creepm.stat[statName];
                if(!statm['max' + statName])
                    statm['max' + statName] = creepm.stat[statName];
                else if (creepm.stat[statName] > statm['max' + statName])
                    statm['max' + statName] = creepm.stat[statName];
        };
        statm["count"] = (statm["count"] || 0) + 1;
    },
};

module.exports = stat;
profiler.registerObject(stat, 'stat');