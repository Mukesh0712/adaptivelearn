import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from './store'

// Typed versions of the react-redux hooks: use these everywhere instead of
// plain useDispatch/useSelector so state and actions are fully typed.
export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()

export const useAuth = () => useAppSelector((state) => state.auth)
