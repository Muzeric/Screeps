var utils = require('utils');
var testmode = 1;

var role = {

    run: function(creep) {
        let targetPos;

        let stopPoint;
        if (Memory.stopPoint)
            stopPoint = Memory.stopPoint;
        if (stopPoint) {
            //console.log(creep.name + ": go to stopPoint " + stopPoint.roomName + ":" + stopPoint.x + "," + stopPoint.y);
            targetPos = stopPoint;
        } else {
            let target;
            if (Memory.attackTargetID) {
                target = Game.getObjectById(Memory.attackTargetID);
            } else {
                let flags = _.filter(Game.flags, f => f.name.substring(0, 6) == 'Attack');
                if(flags.length) {
                    let flag = flags.sort(function(a,b) {return a.pos.x - b.pos.x;})[0];
                    let targets = flag.pos.lookFor(LOOK_STRUCTURES);
                    if (targets.length)
                        target = targets[0];
                }
            }
            
            if (target)
                targetPos = target.pos;
        }

        let healed = 0;
        if (creep.hits < creep.hitsMax) {
            creep.heal(creep);
            healed = 1;
        }

        if (targetPos) {
            if (targetPos.roomName == creep.room.name) {
                let seeked = creep.pos.findClosestByPath(FIND_MY_CREEPS, {filter: c => c.hits < c.hitsMax});
                if (seeked && !healed && creep.heal(seeked) == ERR_NOT_IN_RANGE)
                    creep.moveTo(seeked);
            } else {
                creep.moveTo(targetPos);
            }
        }
	},
	
    create: function(energy) {
        let body = [];

        let hnum = 5;
        energy -= 300 * hnum;
        let tnum = Math.floor(energy / 60);
        if (tnum * 2 + hnum * 2 > 50) // Body parts limit
            tnum = Math.floor((50 - hnum * 2) / 2);
        energy -= 60 * tnum;
        mnum = hnum + tnum;
        
        while (tnum-- > 0)
            body.push(TOUGH);
        while (mnum-- > 0)
            body.push(MOVE);
        while (hnum-- > 0)
            body.push(HEAL);
        
        return [body, energy];
	},
};

module.exports = role;