var utils = require('utils');
const profiler = require('screeps-profiler');

var stat = {
    lastCPU : 0,

    init : function () {
        Memory.stat = Memory.stat || {};
        Memory.stat.CPUHistory = Memory.stat.CPUHistory || {};
        Memory.stat.roomHistory = Memory.stat.roomHistory || {};
        Memory.stat.lastGcl =  Memory.stat.lastGcl || Game.gcl.progress;
        Memory.stat.roomSent = Memory.stat.roomSent || Game.time;
        this.lastCPU = 0;
    },

    addRoom : function (roomName) {
        Memory.stat.roomHistory[roomName] = Memory.stat.roomHistory[roomName] || {};
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
            Memory.stat.CPUHistory["_total"].store = _.sum(_.filter(Memory.rooms, r => r.type == 'my'), r => _.sum(r.store, (v,k) => k == "energy" ? 0 : v));
            Memory.stat.CPUHistory["_total"].gcl = Game.gcl.progress - Memory.stat.lastGcl;
            Memory.stat.CPUHistory["_total"].paths = _.sum(Memory.rooms, r => r.pathCount || 0);
            Memory.stat.CPUHistory["_total"].repairs = _.sum(_.filter(Memory.rooms, r => r.type == 'my'), r => r.repairHits || 0);
            Game.notify(
                "CPUHistory:" + Game.time + ":" + 
                utils.lzw_encode(JSON.stringify(Memory.stat.CPUHistory, function(key, value) {return typeof value == 'number' ? _.floor(value,1) : value;} )) +
                "#END#"
            );
            delete Memory.stat.CPUHistory;
            Memory.stat.lastGcl = Game.gcl.progress;
        }

        if (Game.time - Memory.stat.roomSent > 100) {
            Game.notify(
                "room.3:" + Game.time + ":" + 
                utils.lzw_encode(this.dumpRoomStat()) +
                "#END#"
            );
            delete Memory.stat.roomHistory;
            Memory.stat.roomSent = Game.time;
        }
    },

    dumpRoomStat : function () {
        let res = '';
        let keys = ['harvest', 'create', 'build', 'repair', 'upgrade', 'pickup', 'dead', 'lost', 'cpu'];
        for (let roomName in Memory.stat.roomHistory) {
            res += roomName;
            for (let key of keys) {
                res += ':' + _.floor(Memory.stat.roomHistory[roomName][key] || 0, 1);
            }
            res += ';';
        }

        return res;
    },

    die : function (name) {
        let creepm = Memory.creeps[name];
        this.updateRoom(creepm.roomName, 'dead', -1 * (creepm.carryEnergy || 0));
        return;

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