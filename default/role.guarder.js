const profiler = require('screeps-profiler');

var role = {
    run: function(creep) {
        if (creep.room.name != creep.memory.roomName) {
            let flag = _.filter(Game.flags, f => f.pos.roomName == creep.memory.roomName && f.name.substring(0,f.name.indexOf('.')) == "Guard" )[0];
            if (flag) {
                creep.moveTo(flag, {ignoreHostiled: 1});
                console.log(creep.name + ": goto flag");
            } else {
                console.log(creep.name + ": no guard flag for " + creep.memory.roomName);
            }
            return;
        }

        let mark = {};
        let res = creep.attackNearHostile(50, mark);

        if (creep.hits < creep.hitsMax && creep.getActiveBodyparts(HEAL) && !mark["attacked"])
            creep.heal(creep);
	},
	
    create: function(energy) {
        let body = [];
        
        let tnum = 5;
        let anum = 4;
        let rnum = 4;
        let hnum = 3;
        let mnum = tnum + anum + rnum;
        energy -= 10 * tnum + 80 * anum + 150 * rnum + 50 * mnum + 250 * hnum;

        while (tnum-- > 0)
            body.push(TOUGH);
        while (mnum-- > 0)
            body.push(MOVE);
        while (anum-- > 0)
            body.push(ATTACK);
        while (rnum-- > 0)
            body.push(RANGED_ATTACK);
        while (hnum-- > 0)
            body.push(HEAL);
        
        return [body, energy];
	},
};

module.exports = role;
profiler.registerObject(role, 'roleGuarder');