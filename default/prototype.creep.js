Creep.prototype.goFromKeepers = function() {
    let lair;
    if (lair = _.filter(creep.room.getLiveLairs(), l => this.pos.inRangeTo(l, 10))[0] ) {
    //if (lair = creep.pos.findInRange(FIND_STRUCTURES, 10, { filter : s => s.structureType == STRUCTURE_KEEPER_LAIR && s.ticksToSpawn < 10})[0] ) {
        let safePlace = creep.pos.findClosestByPath(utils.getRangedPlaces(creep, lair.pos, 6));
        creep.moveTo(safePlace ? safePlace : Game.rooms[creep.memory.roomName].controller);
        return;
    }

    let hostiles = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 10, {filter: c => c.owner.username == "Source Keeper"});
    if (hostiles.length) {
        let safePlace = creep.pos.findClosestByPath(utils.getRangedPlaces(creep, hostiles[0].pos, 6));
        creep.moveTo(safePlace ? safePlace : Game.rooms[creep.memory.roomName].controller);
        return;
    }
}