const profiler = require('screeps-profiler');

var stat = {
    lastCPU : 0,

    init : function () {
        Memory.stat = Memory.stat || {};
        Memory.stat.CPUHistory = Memory.stat.CPUHistory || {};
        Memory.stat.roomHistory = Memory.stat.roomHistory || {};
        Memory.stat.roleHistory = Memory.stat.roleHistory || {};
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

    addRole : function (role) {
        Memory.stat.roleHistory[role] = Memory.stat.roleHistory[role] || {};
    },

    updateRole : function (role, param, diff) {
        this.addRole(role);
        Memory.stat.roleHistory[role][param] = (Memory.stat.roleHistory[role][param] || 0) + diff;
    },

    addCPU : function (marker) {
        Memory.stat.CPUHistory[marker] = (Memory.stat.CPUHistory[marker] || 0) + (Game.cpu.getUsed() - this.lastCPU);
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
                "CPU.1:" + Game.time + ":" + 
                global.cache.utils.lzw_encode(JSON.stringify(Memory.stat.CPUHistory, function(key, value) {return typeof value == 'number' ? _.floor(value,1) : value;} )) +
                "#END#"
            );
            delete Memory.stat.CPUHistory;
            Memory.stat.lastGcl = Game.gcl.progress;
        }

        if (Game.time - Memory.stat.roomSent > 100) {
            this.dumpRoomStat();
            delete Memory.stat.roomHistory;
            this.dumpRoleStat();
            delete Memory.stat.roleHistory;
            Memory.stat.roomSent = Game.time;
        }
    },

    dumpRoomStat : function () {
        let res = '';
        let keys = ['harvest', 'create', 'build', 'repair', 'upgrade', 'pickup', 'dead', 'lost', 'cpu', 'send'];
        let lite = _.keys(Memory.stat.roomHistory).length > 20;
        let msgs = [];
        for (let roomName in Memory.stat.roomHistory) {
            if (lite && (!(roomName in Memory.rooms) || ["my", "reserved", "lair", "banked"].indexOf(Memory.rooms[roomName].type) == -1))
                continue;
            res += roomName;
            for (let key of keys) {
                res += ':' + _.floor(Memory.stat.roomHistory[roomName][key] || 0, 1);
            }
            res += ';';
            if (res.length > 900) {
                msgs.push(res);
                res = '';
            }
        }
        if (res.length)
            msgs.push(res);

        for (let msg of msgs) {
            Game.notify(
                "room.4:" + Game.time + ":" + 
                global.cache.utils.lzw_encode(msg) +
                "#END#"
            );
        }

    },

    dumpRoleStat : function () {
        let res = '';
        let keys = ['harvest', 'create', 'build', 'repair', 'upgrade', 'pickup', 'dead', 'cpu', 'sum'];
        let msgs = [];
        for (let role in Memory.stat.roleHistory) {
            res += role;
            for (let key of keys) {
                res += ':' + _.floor(Memory.stat.roleHistory[role][key] || 0, 1);
            }
            res += ';';
            if (res.length > 900) {
                msgs.push(res);
                res = '';
            }
        }
        if (res.length)
            msgs.push(res);

        for (let msg of msgs) {
            Game.notify(
                "role.2:" + Game.time + ":" + 
                global.cache.utils.lzw_encode(msg) +
                "#END#"
            );
        }

    },

    die : function (name) {
        let creepm = Memory.creeps[name];
        this.updateRoom(creepm.roomName, 'dead', -1 * (creepm.carryEnergy || 0));
        this.updateRole(creepm.role, 'dead', -1 * (creepm.carryEnergy || 0));
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