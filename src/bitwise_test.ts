// just play around with bitwise operator

import {
  Bool,
    Field,
    Gadgets,
    Provable,
} from 'o1js';
//import { Gadgets } from 'o1js/dist/node/lib/gadgets/gadgets';
//import { xor } from 'o1js/dist/node/lib/gates';

//-----------------------------------------
// a simple comparison.
console.log("----------------------------------------");
let a = Field(0b0101);
let b = Field(0b0011);

let c = Gadgets.xor(a, b, 4); // xor-ing 16 bits
c.assertEquals(0b0110);

//-----------------------------------------
// the length parameter in xor() is automatically rounded to the nearest multiple of 16.
// even though i specify 4.  it will still do xor of 16bits.
console.log("----------------------------------------");  
a = Field(0b01010101);
b = Field(0b11000011);

c = Gadgets.xor(a, b, 4); // xor-ing 16 bits.  
c.assertEquals(0b10010110);

//-----------------------------------------
// the length parameter in xor() is automatically rounded to the nearest multiple of 16.
// i specify length of 16.  so only 16 bits are compared.  
// comparing 2 numbers of only 16 bits
console.log("----------------------------------------");
a = Field(0b0000000001010101);
b = Field(0b0000000011000011);

c = Gadgets.xor(a, b, 16); // xor-ing 16 bits.  
c.assertEquals(0b10010110);

//-----------------------------------------
// the length parameter in xor() is automatically rounded to the nearest multiple of 16.
// i specify length of 16.  
// i compare 2 numbers of 18 bits.  it wil throw an error.  see more explanation on the documentation in the code file.  
console.log("----------------------------------------");
a = Field(0b010000000001010101);
b = Field(0b110000000011000011);

try {
    c = Gadgets.xor(a, b, 16); // xor-ing 16 bits.  
    c.assertEquals(0b100000000010010110);
} catch (err) {
    console.log("suppose to throw an error.");
    console.log(err);
}

//-----------------------------------------
// the length parameter in xor() is automatically rounded to the nearest multiple of 16.
// i specify length of 17 is fine.  
// i compare 2 numbers of 18 bits.    
console.log("----------------------------------------");
a = Field(0b010000000001010101);
b = Field(0b110000000011000011);

c = Gadgets.xor(a, b, 17); // xor-ing 16 bits.  
c.assertEquals(0b100000000010010110);

//-----------------------------------------
// using number instead of binary
console.log("----------------------------------------");
a = Field(5);
b = Field(0b0011);

c = Gadgets.xor(a, b, 4); // xor-ing 16 bits
c.assertEquals(0b0110);

//-----------------------------------------
// test with number.  
console.log("----------------------------------------");
a = Field(5);
b = Field(0b0011);

c = Gadgets.xor(a, b, 254); // max length that can be specified is (255-1)
c.assertEquals(0b0110);

//-----------------------------------------
// zero out all other bits except the last 6 bits.
console.log("----------------------------------------");
a = Field(0b111111);
b = Field(0b0011001100110011001100110011001100110011001100110011);

c = Gadgets.and(a, b, 254); // this should zero-out all other bits except the last 6 bits.
c.assertEquals(0b110011);

//-----------------------------------------
/*
The flags should be checked according to the following rules :
If flag 1 is true, then all other flags must be false
If flag 2 is true, then flag 3 must also be true.
If flag 4 is true, then flags 5 and 6 must be false.

xor 100000 =>  if result is 0, then we know rule1 passes.  

and 011000 => result is 011000, then rule2 passes.  

never mind, find a better way.  

i decide to go a different route.  it should be easier to use mask to get each of the 6 bits.  then start doing the if statement.  
*/


//-----------------------------------------
/*
instead of doing bitwise operations, maybe we should just convert the field into array.  

The flags should be checked according to the following rules :
If flag 1 is true, then all other flags must be false
If flag 2 is true, then flag 3 must also be true.
If flag 4 is true, then flags 5 and 6 must be false.
*/
let d = Field(0b1100011111000010101010110100001011111);
let bitmap = d.toBits();

// the bitmap is indexed from right to left.  [0] is at the right. 
let flag1:Bool = bitmap[0];
let flag2:Bool = bitmap[1];
let flag3:Bool = bitmap[2];
let flag4:Bool = bitmap[3];
let flag5:Bool = bitmap[4];
let flag6:Bool = bitmap[5];

let rule1Satisfied:Bool = Provable.if(flag1, 
    flag2.not()
    .and(flag3.not())
    .and(flag4.not())
    .and(flag5.not())
    .and(flag6.not()),
    Bool(true));

let rule2Satisfied:Bool = Provable.if(flag2, flag3, Bool(true));

let rule3Satisfied:Bool = Provable.if(flag4, flag5.not().and(flag6.not()), Bool(true));

console.log(`rule1 satisfied: %s`, rule1Satisfied.toBoolean());
console.log(`rule2 satisfied: %s`, rule2Satisfied.toBoolean());
console.log(`rule3 satisfied: %s`, rule3Satisfied.toBoolean());

Provable.assertEqual(rule1Satisfied, Bool(false));
Provable.assertEqual(rule2Satisfied, Bool(true));
Provable.assertEqual(rule3Satisfied, Bool(false));