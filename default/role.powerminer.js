const profiler = require('screeps-profiler');

var role = {
    run: function(creep) {
        if (!creep.memory.targetID || !creep.memory.targetPos) {
            if (
                !(creep.memory.roomName in Memory.rooms) || 
                !("structures" in Memory.rooms[creep.memory.roomName]) ||
                !(STRUCTURE_POWER_BANK in Memory.rooms[creep.memory.roomName].structures) ||
                !Memory.rooms[creep.memory.roomName].structures[STRUCTURE_POWER_BANK].length
            ) {
                console.log(creep.name + ": no power bank in " + creep.memory.roomName);
                return;
            }

            let pb = Memory.rooms[creep.memory.roomName].structures[STRUCTURE_POWER_BANK][0];
            if (!("rangedPlaces" in pb) || !pb.rangedPlaces.length) {
                console.log(creep.name + ": no rangedPlaces for power bank");
                return;
            } else if (!pb.ticksToDecay || pb.hits / (pb.ticksToDecay + 1) > 1000) {
                console.log(creep.name + ": too many hits=" + pb.hits + " for ticks=" + pb.ticksToDecay);
                return;
            }

            creep.memory.targetPos = pb.pos;
            creep.memory.targetID = pb.id;
            creep.memory.attackSum = 0;
            for (let part of _.filter(this.body, p => p.type == ATTACK && p.hits)) {
                if (part.boost && part.boost in BOOSTS["attack"] && "attack" in BOOSTS["attack"][part.boost])
                    creep.memory.attackSum += BOOSTS["attack"][part.boost]["attack"];
                else
                    creep.memory.attackSum++;
            }
        }

        if (creep.room.name != creep.memory.targetPos.roomName) {
            let pos = new RoomPosition(creep.memory.targetPos.x, creep.memory.targetPos.y, creep.memory.targetPos.roomName);
            creep.moveTo(pos);
        } else {
            let target = Game.getObjectById(creep.memory.targetID);
            if (!target) {
                console.log(creep.name + ": no target with id=" + creep.memory.targetID);
                delete creep.memory.targetID;
                return;
            }
            if (creep.hits > creep.memory.attackSum / 2) {
                let res = creep.attack(target);
                if (res == ERR_NOT_IN_RANGE)
                    creep.moveTo(target);
            }
        }
	},
	
    create: function(energy) {
        let body = [];
        /*
        body.push(MOVE);
        energy -= 50;
        return [body, energy];
        */

        // 80 * 25  + 50 * 25 = 3250
        let anum = 25;
        let mnum = 25;
        energy -= 80 * anum + 50 * mnum;

        while (mnum-- > 0)
            body.push(MOVE);
        while (anum-- > 0)
            body.push(ATTACK);
        
        return [body, energy];
	},
};

module.exports = role;
profiler.registerObject(role, 'rolePowerMiner');