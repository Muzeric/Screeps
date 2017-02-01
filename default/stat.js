var stat = {
    lastCPU : 0,
    currentRow : {},

    init : function () {
        if (!Memory.stat) 
            Memory.stat = {};
        if (!Memory.stat.CPUHistory) {
            Memory.stat.CPUHistory = [];
            Memory.stat.CPUHistoryIndex = 0;
        }
        this.currentRow = {
            tick: Game.time,
        };
        return Memory.stat;
    },

    addCPU : function (marker, info) {
        if (this.currentRow[marker])
            console.log("addCPU: duplicate marker=" + marker);

        this.currentRow[marker] = {
            cpu: Game.cpu.getUsed() - this.lastCPU,
            info: info,
        };
        if (marker == "finish") {
            this.currentRow["_total"] = {
                cpu: Game.cpu.getUsed(),
            };
            Memory.stat.CPUHistoryIndex++;
            if (Memory.stat.CPUHistoryIndex > 10000)
                Memory.stat.CPUHistoryIndex = 0;
            Memory.stat.CPUHistory[Memory.stat.CPUHistoryIndex] = this.currentRow;
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