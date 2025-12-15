import styled, {css} from 'styled-components';

const TrafficLight = styled.View`
    border-radius: 50px;
    height: 10px;
    width: 10px;
    padding: 10px;

    ${props => props.available && css`
        background: #afeba0;
    `}

    ${props => props.limited && css`
        background: #f0e68c;
    `}

    ${props => props.unavailable && css`
        background: #ff6347;
    `}
`;

export default TrafficLight;