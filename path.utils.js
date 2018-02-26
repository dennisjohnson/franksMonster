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
