var utils = require('utils');

RoomPosition.prototype.isBorder = function () {
    return (this.x == 0 || this.x == 49 || this.y == 0 || this.y == 49) ? true : false;
}


RoomPosition.prototype.getKey = function (long) {
    return this.x + "x" + this.y + (long ? this.roomName : '');
}

RoomPosition.prototype.invertBorderPos = function () {
    let x = this.x;
    let y = this.y;
    let roomName;
    let exits = Game.map.describeExits(this.roomName);
    if (this.x == 49) {
        x = 0;
        roomName = exits[RIGHT];
    } else if (this.x == 0) {
        x = 49;
        roomName = exits[LEFT];
    } else if (this.y == 49) {
        y = 0;
        roomName = exits[BOTTOM];
    } else if (this.y == 0) {
        y = 49;
        roomName = exits[TOP];
    } else {
        return this;
    }
    
    return new RoomPosition(x, y, roomName);
}

let origgetDirectionTo = RoomPosition.prototype.getDirectionTo;
RoomPosition.prototype.getDirectionTo = function (pos) {
    if (this.roomName == pos.roomName)
        return origgetDirectionTo.apply(this, arguments);
    
    let dir = _.reduce(Game.map.describeExits(this.roomName), function(a,v,k) {return v == pos.roomName ? k : a;}, 0);
    switch (_.parseInt(dir)) {
        case LEFT:
            if (pos.y > this.y)
                return BOTTOM_LEFT;
            else if (pos.y < this.y)
                return TOP_LEFT;
            break;
        case RIGHT:
            if (pos.y > this.y)
                return BOTTOM_RIGHT;
            else if (pos.y < this.y)
                return TOP_RIGHT;
            break;
        case TOP:
            if (pos.x > this.x)
                return TOP_RIGHT;
            else if (pos.x < this.x)
                return TOP_LEFT;
            break;
        case BOTTOM:
            if (pos.x > this.x)
                return BOTTOM_RIGHT;
            else if (pos.x < this.x)
                return BOTTOM_LEFT;
            break;
        default:
            console.log("getDirectionTo from " + this.roomName + " to " + pos.roomName + " got dir=" + dir);
    }
    return dir;
}

RoomPosition.prototype.move = function (dir) {
    let x = this.x;
    let y = this.y;
    let roomName = this.roomName;

    switch (_.parseInt(dir)) {
        case LEFT:
            x--;
            break;
        case RIGHT:
            x++;
            break;
        case TOP:
            y--;
            break;
        case BOTTOM:
            y++;
            break;
        case TOP_LEFT:
            x--;
            y--;
            break;
        case TOP_RIGHT:
            x++;
            y--;
            break;
        case BOTTOM_LEFT:
            x--;
            y++;
            break;
        case BOTTOM_RIGHT:
            x++;
            y++;
            break;
        default:
            console.log("RoomPosition.move: unknown dir=" + dir);
    }

    let exits = Game.map.describeExits(this.roomName);
    if (x <= 0) {
        x = 49;
        roomName = exits[LEFT];
    } else if (x >= 49) {
        x = 0;
        roomName = exits[RIGHT];
    } else if (y <= 0) {
        y = 49;
        roomName = exits[TOP];
    } else if (y >= 49) {
        y = 0;
        roomName = exits[BOTTOM];
    }

    return new RoomPosition(x, y, roomName);
}

RoomPosition.prototype.change = function (diffx, diffy, inRoom) {
    let x = this.x;
    let y = this.y;
    let roomName = this.roomName;

    x += _.parseInt(diffx);
    y += _.parseInt(diffy);

    if (inRoom) {
        x = utils.clamp(x, 0, 49);
        y = utils.clamp(y, 0, 49);
    } else {
        let exits = Game.map.describeExits(this.roomName);
        if (x <= 0) {
            x = 49;
            roomName = exits[LEFT];
        } else if (x >= 49) {
            x = 0;
            roomName = exits[RIGHT];
        } else if (y <= 0) {
            y = 49;
            roomName = exits[TOP];
        } else if (y >= 49) {
            y = 0;
            roomName = exits[BOTTOM];
        }
    }

    return new RoomPosition(x, y, roomName);
}