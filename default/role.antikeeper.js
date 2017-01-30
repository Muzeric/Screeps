var utils = require('utils');

var role = {

    run: function(creep) {
        if (creep.hits < creep.hitsMax && creep.getActiveBodyparts(HEAL))
            creep.heal(creep);
	    
        if (creep.room.name != creep.memory.roomName) {
            if (!Game.flags["Antikeeper." + creep.memory.roomName]) {
                console.log(creep.name + " no flag in " + creep.memory.roomName);
                return;
            }
            creep.moveTo(Game.flags["Antikeeper." + creep.memory.roomName]);
            return;
        }

        let target = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS);
        if (target) {
            let rangedPlaces = creep.room.lookAtArea(target.pos.y - 3, target.pos.x - 3, target.pos.y + 3, target.pos.x + 3, 1 );
        }

	},
	
    create: function(energy) {
        energy -= 900; // MOVE,HEAL at end
        let body = [];
        let tnum = 1;
        while(tnum-- > 0 && energy >= 60) { // 60 (960)
            body.push(TOUGH);
            energy -= 10;
            body.push(MOVE);
            energy -= 50;
        }
        
        let mnum = Math.floor(energy / (50+80));
        let anum = mnum;
        while (energy >= 50 && mnum-- > 0) {
            body.push(MOVE);
            energy -= 50;
        }
        while (energy >= 80 && anum-- > 0) {
            body.push(ATTACK);
            energy -= 80;
        }
        let hnum = 3;
        while (hnum-- > 0) {
            body.push(MOVE);
            body.push(HEAL);
        }

        return [body, energy];
	},
};

module.exports = role;