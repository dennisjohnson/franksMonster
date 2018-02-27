module.exports = {
    reversePath: reversePath
};

function reversePath(path) {
    if (path.path){
        let reverse = Object.assign({}, path);
        reverse.path = reversePathArray(path.path);

        return reverse;
    }
    return reversePathArray(path);
}

function reversePathArray(path){
    console.log("Path before reversal: ", JSON.stringify(path));
    return [...path].reverse()
}


function moveToByPatfinderPath(creep, path){
    if(path.path){path = path.path}
    let minRange, minRangeIndex;
    let j = -1;
    for (let i = path.length; i >=0 ; i--){
        j++;
        let currentSpot = new RoomPosition(path[i].x, path[i].y, path[i].roomName);
        let deltas = getDeltas(creep.pos, currentSpot);
        let rangeToCurrentSpot = getRangeFromDeltas(deltas);
        if (rangeToCurrentSpot === 1){
            moveOneStep(creep, deltas);
        }
    }
}

function getDeltas(startPos, destPos){
    if(startPos.roomName !== destPos.roomName){return {"x": 100, "y": 100};}
    return {"x": destPos.x - startPos.x, "y": destPos.y - startPos.y}
}
function getRangeFromDeltas(deltas){
    return max(Math.abs(deltas.x), Math.abs(deltas.y));
}

function moveOneStep(creep, deltas){
    return creep.move(getDirectionFromDeltas(deltas));

}
function getDirectionFromDeltas(deltas){
    let direction = 0; //TOP
    if (deltas.y < 0){direction = direction + TOP;}
    if (deltas.y === 0){}
    if (deltas.y === 0){}
    if (deltas.y === 0){}
    if (deltas.y === 0){}
    if (deltas.y === 0){}
}