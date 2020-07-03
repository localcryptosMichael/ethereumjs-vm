import BN = require('bn.js')
import { PrecompileInput } from './types'
import { VmErrorResult, ExecResult, OOGResult } from '../evm'
import { ERROR, VmError } from '../../exceptions'
const assert = require('assert')
const { BLS12_381_ToG1Point, BLS12_381_FromG1Point } = require('./util/bls12_381')

export default async function (opts: PrecompileInput): Promise<ExecResult> {
  assert(opts.data)

  const mcl = opts._VM._mcl

  let inputData = opts.data

  // note: the gas used is constant; even if the input is incorrect.
  let gasUsed = new BN(opts._common.param('gasPrices', 'Bls12381G1AddGas'))

  if (opts.gasLimit.lt(gasUsed)) {
    return OOGResult(opts.gasLimit)
  }

  if (inputData.length != 256) {
    return VmErrorResult(new VmError(ERROR.BLS_12_381_INVALID_INPUT_LENGTH), gasUsed)
  }

  // check if some parts of input are zero bytes.
  const zeroBytes16 = Buffer.alloc(16, 0)
  const zeroByteCheck = [
    [0, 16],
    [64, 80],
    [128, 144],
    [192, 208],
  ]

  for (let index in zeroByteCheck) {
    let slicedBuffer = opts.data.slice(zeroByteCheck[index][0], zeroByteCheck[index][1])
    if (!slicedBuffer.equals(zeroBytes16)) {
      return VmErrorResult(new VmError(ERROR.BLS_12_381_POINT_NOT_ON_CURVE), gasUsed)
    }
  }

  // convert input to mcl G1 points, add them, and convert the output to a Buffer.
  let mclPoint1
  let mclPoint2
  try {
    mclPoint1 = BLS12_381_ToG1Point(opts.data.slice(0, 128), mcl)
    mclPoint2 = BLS12_381_ToG1Point(opts.data.slice(128, 256), mcl)
  } catch(e) {
    return VmErrorResult(e, gasUsed)
  }

  const result = mcl.add(mclPoint1, mclPoint2)

  const returnValue = BLS12_381_FromG1Point(result)

  return {
    gasUsed,
    returnValue: returnValue,
  }
}
