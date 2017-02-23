var utils = require('utils');

var stat = {
    lastCPU : 0,

    init : function () {
        if (!Memory.stat) 
            Memory.stat = {};
        if (!Memory.stat.CPUHistory)
            Memory.stat.CPUHistory = {};
        this.lastCPU = 0;
        return Memory.stat;
    },

    addCPU : function (marker, info) {
        if(!Memory.stat.CPUHistory[marker])
            Memory.stat.CPUHistory[marker] = { cpu: 0};
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
        
        if (marker == "finish") {
            if(!Memory.stat.CPUHistory["_total"])
                Memory.stat.CPUHistory["_total"] = {cpu: 0, count: 0};
            
            Memory.stat.CPUHistory["_total"].cpu += Game.cpu.getUsed();
            Memory.stat.CPUHistory["_total"].count++;
            if (Memory.stat.CPUHistory["_total"].count >= 100) {
                Memory.stat.CPUHistory["_total"].bucket = Game.cpu.bucket;
                Memory.stat.CPUHistory["_total"].creeps = _.keys(Game.creeps).length;
                Memory.stat.CPUHistory["_total"].energy = _.sum(_.filter(Memory.rooms, r => r.type == 'my'), r => r.energy);
                Game.notify(
                    "CPUHistory:" + Game.time + ":" + 
                    utils.lzw_encode(JSON.stringify(Memory.stat.CPUHistory, function(key, value) {return typeof value == 'number' ? _.floor(value,1) : value;} )) +
                    "#END#"
                );
                delete Memory.stat.CPUHistory;
            }
        } else {
            this.lastCPU = Game.cpu.getUsed();
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