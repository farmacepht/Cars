class Person{
    constructor(name, age){
        this.name = name;
        this.age = age;
    }
    printHumanProps(){
        console.log(this.name, this.age);
    }
    sayHello(){
        console.log("HelloWorld!");
    }
    getHumanProps(){
        return this.name + " - " + this.age + " лет.";
    }
}